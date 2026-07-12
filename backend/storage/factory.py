import os
from .base import StorageBackend
from .local import LocalStorageBackend


def get_storage() -> StorageBackend:
    """Return the configured storage backend instance."""
    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "s3":
        from .s3 import S3StorageBackend
        return S3StorageBackend(
            bucket=os.getenv("S3_BUCKET", ""),
            region=os.getenv("AWS_REGION", "us-east-1"),
        )
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    return LocalStorageBackend(base_path=upload_dir)
