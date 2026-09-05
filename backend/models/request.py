"""Request models for API endpoints"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class LoginRequest(BaseModel):
    """Login request model"""
    username: EmailStr
    password: str = Field(..., min_length=1)

class WarrantyCreateRequest(BaseModel):
    """Create warranty request"""
    serialNumber: str = Field(..., min_length=1)
    productName: str = Field(..., min_length=1)
    productCategory: str
    purchaseDate: str  # ISO 8601 date
    warrantyMonths: int = Field(default=24, ge=1, le=120)

class WarrantyUpdateRequest(BaseModel):
    """Update warranty request"""
    warrantyMonths: Optional[int] = None
    notes: Optional[str] = None

class ComplaintCreateRequest(BaseModel):
    """Create complaint request"""
    warrantyId: str
    serialNumber: str
    description: str = Field(..., min_length=10, max_length=1000)
    priority: str = Field(default="MEDIUM")

class ComplaintUpdateRequest(BaseModel):
    """Update complaint request"""
    description: Optional[str] = None
    priority: Optional[str] = None

class ComplaintResolveRequest(BaseModel):
    """Resolve complaint request"""
    status: str
    resolutionNotes: str = Field(..., min_length=1)

class S3UploadUrlRequest(BaseModel):
    """Request presigned S3 URL"""
    fileName: str
    fileType: str
    uploadType: str  # "invoice" or "complaint-attachment"

class PresignedUrlResponse(BaseModel):
    """Presigned URL response"""
    uploadUrl: str
    s3Key: str
    expiresIn: int
