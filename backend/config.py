"""Configuration and environment settings"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional, List, Any
import os
import json

def _parse_cors_origins(raw: str) -> List[str]:
    """
    Parse CORS_ORIGINS env variable which may be:
      - A JSON array:  '["https://a.com","https://b.com"]'
      - Comma-separated: 'https://a.com,https://b.com'
    """
    raw = raw.strip()
    if raw.startswith("["):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return [o.strip() for o in raw.split(",") if o.strip()]


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # ============ ENVIRONMENT ============
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "local")

    # ============ AWS REGION & CREDENTIALS ============
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID", None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY", None)

    # ============ DYNAMODB CONFIGURATION ============
    DYNAMODB_TABLE_NAME: str = os.getenv("DYNAMODB_TABLE_NAME", "WarrantyComplaintHub")

    # ============ S3 STORAGE CONFIGURATION ============
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "a3tv-storage")
    S3_INVOICES_BUCKET: str = os.getenv("S3_INVOICES_BUCKET", os.getenv("S3_BUCKET_NAME", "a3tv-storage"))
    S3_ATTACHMENTS_BUCKET: str = os.getenv("S3_ATTACHMENTS_BUCKET", os.getenv("S3_BUCKET_NAME", "a3tv-storage"))
    S3_PRESIGNED_URL_EXPIRATION: int = int(os.getenv("S3_PRESIGNED_URL_EXPIRATION", "3600"))

    # ============ JWT TOKEN CONFIGURATION ============
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # ============ COGNITO CONFIGURATION ============
    COGNITO_USER_POOL_ID: Optional[str] = os.getenv("COGNITO_USER_POOL_ID", None)
    COGNITO_CLIENT_ID: Optional[str] = os.getenv("COGNITO_CLIENT_ID", None)

    # ============ CORS CONFIGURATION ============
    # Reads CORS_ORIGINS env variable as a JSON array or comma-separated string.
    # Default: allow all localhost ports for local development.
    # Production: set CORS_ORIGINS=https://your-cloudfront-domain.cloudfront.net
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            return _parse_cors_origins(v)
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

