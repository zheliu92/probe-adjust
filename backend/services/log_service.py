import json
import os
from datetime import datetime, timezone
from pathlib import Path


def get_log_dir() -> Path:
    log_dir = Path(os.getenv("LOG_DIR", "./logs")).resolve()
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def get_log_file_path(session_id: str) -> Path:
    """Derive the JSONL log file path from the session ID.
    
    session_id format: {participantId}_{ISO-timestamp}
    e.g., "R01_20240901T143022"
    """
    return get_log_dir() / f"session_{session_id}.jsonl"


def append_log_event(session_id: str, event: str, payload: dict) -> None:
    """Append one JSON line to the session's JSONL log file."""
    log_path = get_log_file_path(session_id)
    record = {
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def append_protocol_edit_event(session_id: str, before: str, after: str) -> None:
    """Log a protocol_edit event with a compact line-level diff."""
    import difflib
    before_lines = before.splitlines(keepends=True)
    after_lines = after.splitlines(keepends=True)
    diff = "".join(
        difflib.unified_diff(before_lines, after_lines, lineterm="", n=1)
    )
    append_log_event(session_id, "protocol_edit", {"diff": diff})
