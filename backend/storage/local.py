from pathlib import Path
from .base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_file(self, relative_path: str, content: bytes) -> str:
        full_path = self.base_path / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        return relative_path

    def read_file(self, relative_path: str) -> bytes:
        return (self.base_path / relative_path).read_bytes()

    def delete_file(self, relative_path: str) -> None:
        path = self.base_path / relative_path
        if path.exists():
            path.unlink()

    def file_exists(self, relative_path: str) -> bool:
        return (self.base_path / relative_path).exists()
