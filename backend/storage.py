"""Storage module - handles AWS S3 storage"""
import logging
import re
from typing import Dict
import boto3
from config import settings

logger = logging.getLogger(__name__)

# S3 client
s3_client = None


def init_s3():
    """Initialize S3 client for AWS production"""
    global s3_client
    
    try:
        s3_client = boto3.client(
            's3',
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        logger.info("S3 client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize S3 client: {str(e)}")
        raise


def save_file_s3(file_content: bytes, bucket: str, s3_key: str) -> str:
    """
    Save file to AWS S3
    """
    if s3_client is None:
        raise RuntimeError("S3 client not initialized")
    
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=file_content,
            ServerSideEncryption='AES256'
        )
        logger.info(f"File saved to S3: s3://{bucket}/{s3_key}")
        return s3_key
    except Exception as e:
        logger.error(f"Error saving file to S3: {str(e)}")
        raise


def save_invoice(serial_number: str, file_content: bytes, filename: str) -> str:
    """Save invoice file to S3"""
    safe_serial_number = re.sub(r"[^A-Za-z0-9._-]", "_", serial_number.strip())
    s3_key = f"invoices/{safe_serial_number}/{filename}"
    return save_file_s3(file_content, settings.S3_BUCKET_NAME, s3_key)


def save_complaint_attachment(user_id: str, complaint_id: str, file_content: bytes, filename: str) -> str:
    """Save complaint attachment to S3"""
    s3_key = f"attachments/{user_id}/{complaint_id}/{filename}"
    return save_file_s3(file_content, settings.S3_BUCKET_NAME, s3_key)


def get_presigned_url(bucket: str, s3_key: str, expiration: int = None) -> str:
    """Generate presigned URL for S3 object (read access)"""
    if s3_client is None:
        raise RuntimeError("S3 client not initialized")
    
    try:
        exp_time = expiration or settings.S3_PRESIGNED_URL_EXPIRATION
        
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': s3_key},
            ExpiresIn=exp_time
        )
        logger.info(f"Generated presigned URL for: {s3_key}")
        return url
    except Exception as e:
        logger.error(f"Error generating presigned URL: {str(e)}")
        raise


def delete_file_s3(bucket: str, s3_key: str) -> None:
    """Delete file from S3"""
    if s3_client is None:
        raise RuntimeError("S3 client not initialized")
    
    try:
        s3_client.delete_object(Bucket=bucket, Key=s3_key)
        logger.info(f"Deleted file from S3: s3://{bucket}/{s3_key}")
    except Exception as e:
        logger.error(f"Error deleting file from S3: {str(e)}")
        raise


def get_storage_info() -> Dict:
    """Get information about current storage configuration"""
    return {
        "storage_type": "s3",
        "region": settings.AWS_REGION,
        "invoices_bucket": settings.S3_INVOICES_BUCKET,
        "attachments_bucket": settings.S3_ATTACHMENTS_BUCKET,
        "presigned_url_expiration": f"{settings.S3_PRESIGNED_URL_EXPIRATION}s",
        "description": "Files stored in AWS S3"
    }
