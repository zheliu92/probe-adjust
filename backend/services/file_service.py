import json
from pathlib import Path


def prepare_file_content(file_path_bytes: bytes, file_name: str) -> str:
    """Parse a file's raw bytes and return line-numbered text for LLM injection.
    
    Lines are prefixed with L{n}: so the LLM can cite specific lines and the
    frontend viewer can scroll to and highlight them.
    """
    ext = Path(file_name).suffix.lower()
    text = file_path_bytes.decode("utf-8", errors="replace")

    if ext == ".json":
        try:
            data = json.loads(text)
            text = json.dumps(data, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            pass  # fall through to plain-text line numbering

    lines = text.splitlines()
    return "\n".join(f"L{i + 1}: {line}" for i, line in enumerate(lines))


def parse_file_to_lines(file_path_bytes: bytes, file_name: str) -> list[dict]:
    """Return list of {n, text} dicts for the file viewer endpoint."""
    ext = Path(file_name).suffix.lower()
    text = file_path_bytes.decode("utf-8", errors="replace")

    if ext == ".json":
        try:
            data = json.loads(text)
            text = json.dumps(data, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            pass

    lines = text.splitlines()
    return [{"n": i + 1, "text": line} for i, line in enumerate(lines)]
