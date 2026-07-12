from fastapi import APIRouter, Header
from models.schemas import LogEvent
from services.log_service import append_log_event

router = APIRouter(tags=["log"])


@router.post("/log", status_code=200)
def log_event(
    body: LogEvent,
    x_session_id: str = Header(default="unknown_unknown"),
):
    """Append one interaction log event to the session's JSONL file.
    Never returns an error — logging must never block the researcher's workflow.
    """
    try:
        append_log_event(x_session_id, body.event, body.payload)
    except Exception:
        pass  # Silent failure — don't surface logging errors to the user
    return {"ok": True}
