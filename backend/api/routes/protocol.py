import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from models.database import get_db
from models.orm import StudyParticipant, ProtocolSnapshot
from models.schemas import ProtocolOut, ProtocolUpdate, ProtocolSnapshotCreate, ProtocolSnapshotOut
from services.log_service import append_protocol_edit_event

router = APIRouter(tags=["protocol"])


@router.get("/participants/{participant_id}/protocol", response_model=ProtocolOut)
def get_protocol(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    return ProtocolOut(content=p.protocol_content or "", updated_at=p.protocol_updated_at)


@router.put("/participants/{participant_id}/protocol", response_model=ProtocolOut)
def save_protocol(
    participant_id: str,
    body: ProtocolUpdate,
    db: Session = Depends(get_db),
    x_session_id: str = Header(default="unknown_unknown"),
):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")

    old_content = p.protocol_content or ""
    new_content = body.content

    if old_content != new_content:
        try:
            append_protocol_edit_event(x_session_id, old_content, new_content)
        except Exception:
            pass  # Never block a save due to logging failure

        p.protocol_content = new_content
        p.protocol_updated_at = datetime.now(timezone.utc)
        db.commit()

    return ProtocolOut(content=p.protocol_content or "", updated_at=p.protocol_updated_at)


@router.post(
    "/participants/{participant_id}/protocol/snapshot",
    response_model=ProtocolSnapshotOut,
    status_code=201,
)
def save_protocol_snapshot(
    participant_id: str,
    body: ProtocolSnapshotCreate,
    db: Session = Depends(get_db),
):
    """Save a full protocol snapshot at the end of a session.

    Called by the frontend on session_end so that each mode session's final
    protocol state is preserved independently — even if the researcher uses
    multiple modes on the same participant.
    """
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")

    snapshot = ProtocolSnapshot(
        id=str(uuid.uuid4()),
        participant_id=participant_id,
        session_id=body.session_id,
        mode=body.mode,
        content=body.content,
        saved_at=datetime.now(timezone.utc),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get(
    "/participants/{participant_id}/protocol/snapshots",
    response_model=list[ProtocolSnapshotOut],
)
def list_protocol_snapshots(participant_id: str, db: Session = Depends(get_db)):
    p = db.query(StudyParticipant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(404, "Participant not found")
    return (
        db.query(ProtocolSnapshot)
        .filter_by(participant_id=participant_id)
        .order_by(ProtocolSnapshot.saved_at.desc())
        .all()
    )
