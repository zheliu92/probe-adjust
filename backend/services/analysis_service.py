"""
Analysis service — LLM orchestration with async in-memory queue.

Queue lifecycle:
  1. API route creates AnalysisRequest row (status=queued), calls enqueue()
  2. Worker (started at app startup) dequeues IDs, processes sequentially
  3. Worker updates DB status to analyzing → complete | error
  4. Frontend polls GET /analysis/requests/{id} until status ∉ {queued, analyzing}
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from models.orm import (
    AnalysisRequest, Finding, Citation, Suggestion, ParticipantDataFile,
    StudyParticipant, DataSlot, Annotation, Block, Study
)
from services.file_service import prepare_file_content
from storage.factory import get_storage

# ── In-memory queue ────────────────────────────────────────────────────────────
_queue: asyncio.Queue[str] = asyncio.Queue()


def enqueue(request_id: str) -> None:
    """Add a request ID to the processing queue (thread-safe)."""
    _queue.put_nowait(request_id)


async def worker(db_factory) -> None:
    """Background worker that processes analysis requests one at a time."""
    while True:
        request_id = await _queue.get()
        db: Session = db_factory()
        try:
            req = db.query(AnalysisRequest).filter_by(id=request_id).first()
            if not req:
                continue
            req.status = "analyzing"
            db.commit()
            await _run_analysis(req, db)
        except Exception as e:
            req = db.query(AnalysisRequest).filter_by(id=request_id).first()
            if req:
                req.status = "error"
                req.error_message = str(e)
                req.completed_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()
            _queue.task_done()


# ── Core analysis logic ────────────────────────────────────────────────────────

async def _run_analysis(req: AnalysisRequest, db: Session) -> None:
    use_mock = _should_use_mock()
    if use_mock:
        # 5-second delay so the queue + "analyzing" state is visible in the UI.
        # When a real API key is set this branch is never taken — no artificial wait.
        await asyncio.sleep(5)
        result = _mock_response(req.mode)
    else:
        prompt = await _build_prompt(req, db)
        result = await _call_llm(prompt, req.mode)

    _persist_results(req, result, db)
    req.status = "complete"
    req.completed_at = datetime.now(timezone.utc)
    db.commit()


def _should_use_mock() -> bool:
    key = os.getenv("OPENAI_API_KEY", "placeholder")
    return not key or key == "placeholder"


async def _build_prompt(req: AnalysisRequest, db: Session) -> str:
    storage = get_storage()
    file_ids: list[str] = json.loads(req.sources_used)

    # Fetch participant + study context
    participant = db.query(StudyParticipant).filter_by(id=req.participant_id).first()
    study = db.query(Study).filter_by(id=participant.study_id).first()

    # Fetch all annotations for the study
    blocks = db.query(Block).filter_by(study_id=study.id).all()
    slot_ids = [s.id for b in blocks for s in b.slots]
    annotations = db.query(Annotation).filter(Annotation.slot_id.in_(slot_ids)).all()
    ann_map = {a.slot_id: a.content for a in annotations if a.content.strip()}

    # Build annotation section
    annotation_lines = []
    for slot_id, content in ann_map.items():
        slot = db.query(DataSlot).filter_by(id=slot_id).first()
        if slot:
            annotation_lines.append(f"- [{slot.name}]: {content}")
    annotations_text = "\n".join(annotation_lines) or "(none)"

    # Build data sources section
    sources_text_parts = []
    for file_id in file_ids:
        pf = db.query(ParticipantDataFile).filter_by(id=file_id).first()
        if not pf or not pf.file_path:
            continue
        slot = db.query(DataSlot).filter_by(id=pf.slot_id).first()
        slot_name = slot.name if slot else pf.file_name
        data_type = slot.data_type if slot else "unknown"
        data_nature = slot.data_nature if slot else "unknown"

        try:
            raw = storage.read_file(pf.file_path)
            content = prepare_file_content(raw, pf.file_name)
        except Exception:
            content = "(file could not be read)"

        custom = f"\nFocus instruction: {pf.custom_prompt}" if pf.custom_prompt else ""
        if req.custom_prompt:
            custom += f"\nRequest-level focus: {req.custom_prompt}"

        sources_text_parts.append(
            f"### {slot_name} ({data_type}, {data_nature}){custom}\n---\n{content}"
        )

    sources_text = "\n\n".join(sources_text_parts) or "(no data sources provided)"

    suggestions_instruction = ""
    if req.mode == "suggestions":
        suggestions_instruction = """
Additionally, for each interviewable tension found, provide a protocol adjustment suggestion:
- description: what to add, change, or note in the interview protocol
- related_finding_index: 0-based index of the related finding (optional)
- protocol_ref: hint about where in the protocol this applies (optional)
"""

    schema = json.dumps({
        "findings": [
            {
                "title": "string",
                "explanation": "string (1-2 sentences)",
                "tension_type": "contradiction | convergence | anomaly",
                "citations": [
                    {
                        "source_name": "string (matches slot name above)",
                        "display_ref": "string e.g. 'Survey Q3' or 'Log L42'",
                        "location": {"type": "line", "value": "integer line number"}
                    }
                ]
            }
        ],
        "suggestions": [
            {
                "description": "string",
                "related_finding_index": "integer (optional)",
                "protocol_ref": "string (optional)"
            }
        ]
    }, indent=2)

    return f"""SYSTEM:
You are an expert qualitative research assistant helping researchers analyze experience data from mixed-methods studies.

Your task is to analyze the provided data sources and identify "interviewable tensions" — observations that would be valuable to probe in a follow-up interview.

An interviewable tension is one of:
- Contradiction: conflicting signals across data sources (e.g., low task performance but high satisfaction rating)
- Convergence: strong agreement across multiple sources on a notable theme
- Anomaly: a data point that stands out unexpectedly
{suggestions_instruction}
Return ONLY valid JSON matching the output schema below. No prose outside JSON.

USER:
## Study Context
Title: {study.title}
Description: {study.description or '(none)'}

## Researcher Annotations (use these to focus your analysis)
{annotations_text}

## Data Sources
{sources_text}

## Output Schema
{schema}"""


async def _call_llm(prompt: str, mode: str) -> dict:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return json.loads(response.choices[0].message.content)


def _persist_results(req: AnalysisRequest, result: dict, db: Session) -> None:
    # Map source_name → file_id for citation resolution
    file_ids: list[str] = json.loads(req.sources_used)
    name_to_file_id: dict[str, str] = {}
    for fid in file_ids:
        pf = db.query(ParticipantDataFile).filter_by(id=fid).first()
        if pf and pf.slot_id:
            from models.orm import DataSlot
            slot = db.query(DataSlot).filter_by(id=pf.slot_id).first()
            if slot:
                name_to_file_id[slot.name.lower()] = fid
        if pf:
            name_to_file_id[pf.file_name.lower()] = fid

    findings_raw = result.get("findings", [])
    saved_findings: list[Finding] = []

    for i, f in enumerate(findings_raw):
        finding = Finding(
            id=str(uuid.uuid4()),
            analysis_request_id=req.id,
            position=i,
            title=f.get("title", ""),
            explanation=f.get("explanation", ""),
            tension_type=f.get("tension_type"),
        )
        db.add(finding)
        db.flush()

        for c in f.get("citations", []):
            source_name = c.get("source_name", "").lower()
            matched_file_id = name_to_file_id.get(source_name)
            # fuzzy match if exact miss
            if not matched_file_id:
                for key, fid in name_to_file_id.items():
                    if source_name in key or key in source_name:
                        matched_file_id = fid
                        break

            citation = Citation(
                id=str(uuid.uuid4()),
                finding_id=finding.id,
                file_id=matched_file_id,
                display_ref=c.get("display_ref", ""),
                location=json.dumps(c.get("location", {})),
            )
            db.add(citation)

        saved_findings.append(finding)

    if req.mode == "suggestions":
        for i, s in enumerate(result.get("suggestions", [])):
            related_idx = s.get("related_finding_index")
            related_finding_id = None
            if related_idx is not None and related_idx < len(saved_findings):
                related_finding_id = saved_findings[related_idx].id

            suggestion = Suggestion(
                id=str(uuid.uuid4()),
                analysis_request_id=req.id,
                finding_id=related_finding_id,
                position=i,
                description=s.get("description", ""),
                protocol_ref=s.get("protocol_ref"),
            )
            db.add(suggestion)

    req.raw_llm_response = json.dumps(result)


# ── Mock response ──────────────────────────────────────────────────────────────

def _mock_response(mode: str) -> dict:
    """Realistic mock findings for when OPENAI_API_KEY is placeholder.
    Citations reference line numbers that exist in the seeded mock data."""
    findings = [
        {
            "title": "High trust rating despite repeated task errors",
            "explanation": (
                "The system log records 4 error events and 2 task failures during Condition A, "
                "yet the post-condition survey rates trust at 6/7. This contradiction suggests "
                "the participant may have attributed errors to themselves rather than the system."
            ),
            "tension_type": "contradiction",
            "citations": [
                {"source_name": "System Log", "display_ref": "Log L18",
                 "location": {"type": "line", "value": 18}},
                {"source_name": "Post-Condition Survey", "display_ref": "Survey Q4",
                 "location": {"type": "line", "value": 12}},
            ],
        },
        {
            "title": "Strong preference for Condition B across multiple channels",
            "explanation": (
                "The think-aloud transcript, observation notes, and post-condition survey all "
                "independently indicate a clear preference for Condition B's interface layout. "
                "This convergence makes it a high-priority topic for the interview."
            ),
            "tension_type": "convergence",
            "citations": [
                {"source_name": "Think-Aloud Transcript", "display_ref": "Transcript L31",
                 "location": {"type": "line", "value": 31}},
                {"source_name": "Post-Condition Survey", "display_ref": "Survey Q6",
                 "location": {"type": "line", "value": 18}},
                {"source_name": "Observation Notes", "display_ref": "Notes L9",
                 "location": {"type": "line", "value": 9}},
            ],
        },
        {
            "title": "Anomalous spike in interaction time on Task 3",
            "explanation": (
                "Task 3 took 4.2× the median task duration recorded in the log, yet the "
                "participant did not mention difficulty in the think-aloud. This silent anomaly "
                "may indicate unspoken confusion worth exploring in the interview."
            ),
            "tension_type": "anomaly",
            "citations": [
                {"source_name": "System Log", "display_ref": "Log L34",
                 "location": {"type": "line", "value": 34}},
            ],
        },
    ]

    suggestions = []
    if mode == "suggestions":
        suggestions = [
            {
                "description": (
                    "After Q4 (trust), add a follow-up: 'When you made errors during the task, "
                    "did you feel the system was responsible or did you blame yourself?' "
                    "This probes whether self-attribution explains the contradiction between "
                    "error rate and high trust rating."
                ),
                "related_finding_index": 0,
                "protocol_ref": "Q4 — Trust in the system",
            },
            {
                "description": (
                    "Before Q7 (overall preference), add a note: Check whether the participant "
                    "connects their preference for Condition B to perceived control or efficiency — "
                    "three data sources converge on this preference and the underlying reason is unclear."
                ),
                "related_finding_index": 1,
                "protocol_ref": "Q7 — Overall condition preference",
            },
        ]

    return {"findings": findings, "suggestions": suggestions}
