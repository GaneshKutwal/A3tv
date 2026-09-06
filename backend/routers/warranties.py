"""Warranties routes"""
from fastapi import APIRouter, HTTPException, status, Request, UploadFile, File, Form, Query
from datetime import datetime, timedelta
from typing import Optional, List, Union
import uuid
import os

from models.response import ApiResponse, WarrantyResponse
from auth import get_current_user
from database import create_warranty, get_warranties, get_warranty, update_warranty as db_update_warranty
from storage import save_invoice
from config import settings

router = APIRouter()

@router.post("/warranties", response_model=ApiResponse)
async def create_warranty_endpoint(
    request: Request,
    serialNumber: str = Form(...),
    productName: str = Form(...),
    productCategory: str = Form(...),
    purchaseDate: str = Form(...),
    warrantyMonths: int = Form(24),
    customerName: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    dealerName: Optional[str] = Form(None),
    dealerLocation: Optional[str] = Form(None),
    invoice: Optional[Union[UploadFile, List[UploadFile]]] = File(None),
):
    """Register a new warranty with invoice upload"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Check for duplicate serial number
    existing_warranties = await get_warranties(user_id, {"serialNumber": serialNumber})
    if existing_warranties:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Serial number already exists"
        )
    
    # Handle file upload via storage module (local or S3 depending on environment)
    invoice_paths = []
    warranty_id = str(uuid.uuid4())
    invoice_files = []
    if invoice:
        invoice_files = invoice if isinstance(invoice, list) else [invoice]
        try:
            for invoice_file in invoice_files:
                contents = await invoice_file.read()
                invoice_paths.append(save_invoice(
                    serial_number=serialNumber,
                    file_content=contents,
                    filename=invoice_file.filename,
                ))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File upload failed: {str(e)}"
            )
    
    # Calculate warranty end date
    purchase_date = datetime.fromisoformat(purchaseDate)
    warranty_end_date = purchase_date + timedelta(days=warrantyMonths * 30)
    
    # Create warranty in database
    warranty_data = {
        "userId": user_id,
        "warrantyId": warranty_id,
        "serialNumber": serialNumber,
        "productName": productName,
        "productCategory": productCategory,
        "purchaseDate": purchaseDate,
        "warrantyEndDate": warranty_end_date.date().isoformat(),
        "invoicePaths": invoice_paths,
        "customerName": customerName,
        "phone": phone,
        "email": email,
        "address": address,
        "dealerName": dealerName,
        "dealerLocation": dealerLocation,
    }
    
    warranty = await create_warranty(warranty_data)
    
    return ApiResponse(
        success=True,
        data={
            "warrantyId": warranty["EntityId"],
            "serialNumber": warranty["SerialNumber"],
            "productName": warranty["ProductName"],
            "productCategory": warranty["ProductCategory"],
            "purchaseDate": warranty.get("PurchaseDate"),
            "warrantyEndDate": warranty.get("WarrantyEndDate"),
            "status": warranty.get("Status"),
            "invoicePaths": warranty.get("InvoicePaths", []),
            "customerName": warranty.get("CustomerName"),
            "phone": warranty.get("Phone"),
            "email": warranty.get("Email"),
            "address": warranty.get("Address"),
            "dealerName": warranty.get("DealerName"),
            "dealerLocation": warranty.get("DealerLocation"),
            "createdAt": warranty.get("CreatedAt"),
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.get("/warranties", response_model=ApiResponse)
async def list_warranties(
    request: Request,
    serialNumber: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    productName: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List warranties with optional filters"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Build filters
    filters = {}
    if serialNumber:
        filters["serialNumber"] = serialNumber
    if status:
        filters["status"] = status
    if productName:
        filters["productName"] = productName
    
    # Get warranties
    warranties = await get_warranties(user_id, filters)
    
    # Apply pagination
    paginated = warranties[offset:offset + limit]
    
    return ApiResponse(
        success=True,
        data={
            "warranties": [
                {
                    "warrantyId": w["EntityId"],
                    "serialNumber": w["SerialNumber"],
                    "productName": w["ProductName"],
                    "productCategory": w["ProductCategory"],
                    "purchaseDate": w.get("PurchaseDate"),
                    "warrantyEndDate": w.get("WarrantyEndDate"),
                    "status": w.get("Status"),
                    "invoicePaths": w.get("InvoicePaths", [w["InvoicePath"]] if w.get("InvoicePath") else []),
                    "customerName": w.get("CustomerName"),
                    "phone": w.get("Phone"),
                    "email": w.get("Email"),
                    "address": w.get("Address"),
                    "dealerName": w.get("DealerName"),
                    "dealerLocation": w.get("DealerLocation"),
                    "createdAt": w.get("CreatedAt"),
                }
                for w in paginated
            ],
            "total": len(warranties),
            "limit": limit,
            "offset": offset,
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.get("/warranties/{serial_number}", response_model=ApiResponse)
async def get_warranty_detail(
    serial_number: str,
    request: Request,
):
    """Get warranty details"""
    
    # Verify authentication
    claims = get_current_user(request)
    
    # Get warranty
    warranty = await get_warranty(serial_number)
    
    if not warranty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Warranty not found"
        )
    
    return ApiResponse(
        success=True,
        data={
            "warrantyId": warranty["EntityId"],
            "serialNumber": warranty["SerialNumber"],
            "productName": warranty["ProductName"],
            "productCategory": warranty["ProductCategory"],
            "purchaseDate": warranty.get("PurchaseDate"),
            "warrantyEndDate": warranty.get("WarrantyEndDate"),
            "status": warranty.get("Status"),
            "invoicePaths": warranty.get("InvoicePaths", [warranty["InvoicePath"]] if warranty.get("InvoicePath") else []),
            "customerName": warranty.get("CustomerName"),
            "phone": warranty.get("Phone"),
            "email": warranty.get("Email"),
            "address": warranty.get("Address"),
            "dealerName": warranty.get("DealerName"),
            "dealerLocation": warranty.get("DealerLocation"),
            "createdAt": warranty.get("CreatedAt"),
            "updatedAt": warranty.get("UpdatedAt"),
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )
