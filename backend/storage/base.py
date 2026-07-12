from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Abstract interface for file storage. Swap LocalStorageBackend for
    S3StorageBackend by changing the STORAGE_BACKEND env var."""

    @abstractmethod
    def save_file(self, relative_path: str, content: bytes) -> str:
        """Save content at relative_path. Returns the relative_path stored."""
        ...

    @abstractmethod
    def read_file(self, relative_path: str) -> bytes:
        """Read and return raw bytes for the file at relative_path."""
        ...

    @abstractmethod
    def delete_file(self, relative_path: str) -> None:
        """Delete the file at relative_path. Silent if file does not exist."""
        ...

    @abstractmethod
    def file_exists(self, relative_path: str) -> bool:
        """Return True if the file at relative_path exists."""
        ...
