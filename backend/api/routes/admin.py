"""
Admin endpoints for downloading study data.

GET /api/admin/logs          — Download all JSONL interaction logs as a zip
GET /api/admin/logs/{sid}    — Download a single session's JSONL log
GET /api/admin/export        — Download a zip of all logs + all protocol snapshots as JSON
"""
import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import StudyParticipant, ProtocolSnapshot
from services.log_service import get_log_dir

router = APIRouter(prefix="/admin", tags=["admin"])


def _stream_zip(buf: io.BytesIO, filename: str) -> StreamingResponse:
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/logs")
def download_all_logs():
    """Return all JSONL interaction log files bundled in a single zip."""
    log_dir = get_log_dir()
    log_files = list(log_dir.glob("session_*.jsonl"))
    if not log_files:
        raise HTTPException(404, "No log files found yet")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in log_files:
            zf.write(f, arcname=f.name)
    return _stream_zip(buf, "probe_adjust_logs.zip")


@router.get("/logs/{session_id}")
def download_session_log(session_id: str):
    """Return the JSONL log for a specific session."""
    log_dir = get_log_dir()
    path = log_dir / f"session_{session_id}.jsonl"
    if not path.exists():
        raise HTTPException(404, f"Log for session '{session_id}' not found")

    def iter_file():
        yield path.read_bytes()

    return StreamingResponse(
        iter_file(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="session_{session_id}.jsonl"'},
    )


@router.get("/export")
def download_full_export(db: Session = Depends(get_db)):
    """Download a zip containing:
    - All JSONL interaction logs
    - protocol_snapshots.json  (all per-session protocol snapshots for all participants)
    - participants.json         (participant labels + IDs for cross-reference)
    """
    log_dir = get_log_dir()

    # Build protocol snapshots export
    snapshots = db.query(ProtocolSnapshot).order_by(
        ProtocolSnapshot.participant_id, ProtocolSnapshot.saved_at
    ).all()
    snapshots_data = [
        {
            "participant_id": s.participant_id,
            "participant_label": s.participant.label if s.participant else None,
            "session_id": s.session_id,
            "mode": s.mode,
            "saved_at": s.saved_at.isoformat() if s.saved_at else None,
            "content": s.content,
        }
        for s in snapshots
    ]

    # Build participants export
    participants = db.query(StudyParticipant).order_by(StudyParticipant.created_at).all()
    participants_data = [
        {
            "id": p.id,
            "label": p.label,
            "study_id": p.study_id,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "protocol_content_latest": p.protocol_content,
        }
        for p in participants
    ]

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Log files
        for f in log_dir.glob("session_*.jsonl"):
            zf.write(f, arcname=f"logs/{f.name}")
        # JSON exports
        zf.writestr("protocol_snapshots.json",
                    json.dumps(snapshots_data, indent=2, ensure_ascii=False))
        zf.writestr("participants.json",
                    json.dumps(participants_data, indent=2, ensure_ascii=False))

    return _stream_zip(buf, "probe_adjust_export.zip")
