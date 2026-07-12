from .base import StorageBackend


class S3StorageBackend(StorageBackend):
    """S3 storage backend — for cloud deployment.
    
    To activate: set STORAGE_BACKEND=s3, S3_BUCKET, and AWS_REGION in .env.
    Install boto3: pip install boto3
    """

    def __init__(self, bucket: str, region: str = "us-east-1"):
        raise NotImplementedError(
            "S3StorageBackend is not yet implemented. "
            "Set STORAGE_BACKEND=local in your .env for the prototype."
        )

    def save_file(self, relative_path: str, content: bytes) -> str:
        raise NotImplementedError

    def read_file(self, relative_path: str) -> bytes:
        raise NotImplementedError

    def delete_file(self, relative_path: str) -> None:
        raise NotImplementedError

    def file_exists(self, relative_path: str) -> bool:
        raise NotImplementedError
