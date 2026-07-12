import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import (
    StudyParticipant, ParticipantDataFile, AnalysisRequest, Finding, Citation, Suggestion
)
from models.schemas import AnalysisRequestCreate, AnalysisRequestOut
from services.analysis_service import enqueue

router = APIRouter(tags=["analysis"])


def _serialize_request(req: AnalysisRequest) -> dict:
    """Build a fully nested response dict from an ORM AnalysisRequest."""
    findings_out = []
    for f in req.findings:
        citations_out = []
        for c in f.citations:
            try:
                location = json.loads(c.location) if isinstance(c.location, str) else c.location
            except Exception:
                location = {}
            citations_out.append({
                "id": c.id,
                "finding_id": c.finding_id,
                "file_id": c.file_id,
                "display_ref": c.display_ref,
                "location": location,
            })
        findings_out.append({
            "id": f.id,
            "analysis_request_id": f.analysis_request_id,
            "position": f.position,
            "title": f.title,
            "explanation": f.explanation,
            "tension_type": f.tension_type,
            "citations": citations_out,
        })

    suggestions_out = [
        {
            "id": s.id,
            "analysis_request_id": s.analysis_request_id,
            "finding_id": s.finding_id,
            "position": s.position,
            "description": s.description,
            "protocol_ref": s.protocol_ref,
        }
        for s in req.suggestions
    ]

    return {
        "id": req.id,
        "participant_id": req.participant_id,
        "label": req.label,
        "mode": req.mode,
        "status": req.status,
        "custom_prompt": req.custom_prompt,
        "position": req.position,
        "created_at": req.created_at,
        "completed_at": req.completed_at,
        "findings": findings_out,
        "suggestions": suggestions_out,
    }


@router.post(
    "/participants/{participant_id}/analysis/requests",
    status_code=202,
)
def submit_analysis_request(
    participant_id: str,
    body: AnalysisRequestCreate,
    db: Session = Depends(get_db),
):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")

    if body.mode not in ("findings", "suggestions"):
        # baseline mode requests are stored as "findings" (no suggestions generated)
        body_mode = "findings"
    else:
        body_mode = body.mode

    # Validate file IDs belong to this participant
    for fid in body.file_ids:
        pf = db.query(ParticipantDataFile).filter_by(id=fid, participant_id=participant_id).first()
        if not pf:
            raise HTTPException(400, f"File {fid} not found for this participant")

    # Determine position (append after existing requests)
    position = db.query(AnalysisRequest).filter_by(participant_id=participant_id).count()

    req = AnalysisRequest(
        id=str(uuid.uuid4()),
        participant_id=participant_id,
        label=body.label,
        mode=body_mode,
        status="queued",
        sources_used=json.dumps(body.file_ids),
        custom_prompt=body.custom_prompt,
        position=position,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Enqueue for async processing
    enqueue(req.id)

    return {"id": req.id, "status": "queued"}


@router.get(
    "/participants/{participant_id}/analysis/requests",
    response_model=list[AnalysisRequestOut],
)
def list_analysis_requests(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    requests = (
        db.query(AnalysisRequest)
        .filter_by(participant_id=participant_id)
        .order_by(AnalysisRequest.position)
        .all()
    )
    return [_serialize_request(r) for r in requests]


@router.get("/analysis/requests/{request_id}")
def get_analysis_request(request_id: str, db: Session = Depends(get_db)):
    req = db.query(AnalysisRequest).filter_by(id=request_id).first()
    if not req:
        raise HTTPException(404, "Analysis request not found")
    return _serialize_request(req)


@router.delete("/analysis/requests/{request_id}", status_code=204)
def delete_analysis_request(request_id: str, db: Session = Depends(get_db)):
    req = db.query(AnalysisRequest).filter_by(id=request_id).first()
    if not req:
        raise HTTPException(404, "Analysis request not found")
    db.delete(req)
    db.commit()
