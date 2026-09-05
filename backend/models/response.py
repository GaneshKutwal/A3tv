"""Response models for API responses"""
from pydantic import BaseModel
from typing import TypeVar, Generic, Optional, Any
from datetime import datetime

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper"""
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    timestamp: str = datetime.utcnow().isoformat()

class LoginResponse(BaseModel):
    """Login response with JWT token"""
    accessToken: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: dict

class WarrantyResponse(BaseModel):
    """Warranty response model"""
    warrantyId: str
    serialNumber: str
    productName: str
    productCategory: str
    purchaseDate: str
    warrantyEndDate: str
    status: str
    customerName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    dealerName: Optional[str] = None
    dealerLocation: Optional[str] = None
    createdAt: str
    updatedAt: str

class ComplaintResponse(BaseModel):
    """Complaint response model"""
    complaintId: str
    warrantyId: str
    serialNumber: str
    description: str
    priority: str
    status: str
    createdAt: str
    updatedAt: str
    attachmentCount: int = 0

class DashboardStatsResponse(BaseModel):
    """Dashboard statistics response"""
    totalWarranties: int
    totalComplaints: int
    openComplaints: int
    resolvedComplaints: int
    pendingComplaints: int
    activeWarranties: int
    expiredWarranties: int
