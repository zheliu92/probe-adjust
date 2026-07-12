from fastapi import Header, HTTPException
from models.database import SessionLocal


def get_session_id(x_session_id: str = Header(default="unknown_unknown")) -> str:
    """Extract session ID from X-Session-ID header for interaction logging.
    Format: {participantId}_{ISO-timestamp-compact}
    """
    return x_session_id
