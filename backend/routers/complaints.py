"""Complaints routes"""
from fastapi import APIRouter, HTTPException, status, Request, UploadFile, File, Form, Query
from datetime import datetime
from typing import Optional, List
import os

from models.response import ApiResponse, ComplaintResponse
from auth import get_current_user
from database import (
    create_complaint,
    generate_complaint_id,
    get_complaints,
    get_complaint,
    update_complaint as db_update_complaint,
)
from storage import save_complaint_attachment
from config import settings

router = APIRouter()

@router.post("/complaints", response_model=ApiResponse)
async def create_complaint_endpoint(
    request: Request,
    warrantyId: str = Form(...),
    serialNumber: str = Form(...),
    description: str = Form(...),
    priority: str = Form("MEDIUM"),
    assignedTo: Optional[str] = Form(None),
    loggedBy: Optional[str] = Form(None),
    attachments: Optional[List[UploadFile]] = File(None),
):
    """File a new complaint with attachments"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Handle file uploads via storage module (local or S3 depending on environment)
    attachment_paths = []
    complaint_id = await generate_complaint_id()
    if attachments:
        try:
            for attachment in attachments:
                contents = await attachment.read()
                path = save_complaint_attachment(
                    user_id=user_id,
                    complaint_id=complaint_id,
                    file_content=contents,
                    filename=attachment.filename,
                )
                attachment_paths.append(path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File upload failed: {str(e)}"
            )
    
    # Create complaint in database
    complaint_data = {
        "userId": user_id,
        "complaintId": complaint_id,
        "warrantyId": warrantyId,
        "serialNumber": serialNumber,
        "description": description,
        "priority": priority,
        "assignedTo": assignedTo,
        "loggedBy": loggedBy or "Service Desk",
        "attachmentPaths": attachment_paths,
    }
    
    complaint = await create_complaint(complaint_data)
    
    return ApiResponse(
        success=True,
        data={
            "complaintId": complaint["EntityId"],
            "warrantyId": complaint["WarrantyId"],
            "serialNumber": complaint["SerialNumber"],
            "description": complaint["Description"],
            "loggedBy": complaint.get("LoggedBy", complaint.get("UserId", "Service Desk")),
            "priority": complaint["Priority"],
            "status": complaint["Status"],
            "assignedTo": complaint.get("AssignedTo"),
            "notes": complaint.get("Notes", []),
            "attachmentCount": len(attachment_paths),
            "createdAt": complaint["CreatedAt"],
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.get("/complaints", response_model=ApiResponse)
async def list_complaints(
    request: Request,
    status: Optional[str] = Query(None),
    serialNumber: Optional[str] = Query(None),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List complaints with optional filters"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Build filters
    filters = {}
    if status:
        filters["status"] = status
    if serialNumber:
        filters["serialNumber"] = serialNumber
    if priority:
        filters["priority"] = priority
    
    # Get complaints
    complaints = await get_complaints(user_id, filters)
    
    # Apply pagination
    paginated = complaints[offset:offset + limit]
    
    return ApiResponse(
        success=True,
        data={
            "complaints": [
                {
                    "complaintId": c["EntityId"],
                    "warrantyId": c["WarrantyId"],
                    "serialNumber": c["SerialNumber"],
                    "description": c["Description"],
                    "loggedBy": c.get("LoggedBy", c.get("UserId", "Service Desk")),
                    "priority": c["Priority"],
                    "status": c["Status"],
                    "assignedTo": c.get("AssignedTo"),
                    "notes": c.get("Notes", []),
                    "resolutionNotes": c.get("ResolutionNotes"),
                    "resolvedAt": c.get("ResolvedAt"),
                    "createdAt": c["CreatedAt"],
                    "attachmentCount": len(c.get("AttachmentPaths", [])),
                }
                for c in paginated
            ],
            "total": len(complaints),
            "limit": limit,
            "offset": offset,
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.get("/complaints/{complaint_id}", response_model=ApiResponse)
async def get_complaint_detail(
    complaint_id: str,
    request: Request,
):
    """Get complaint details"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Get complaint
    complaint = await get_complaint(user_id, complaint_id)
    
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    
    return ApiResponse(
        success=True,
        data={
            "complaintId": complaint["EntityId"],
            "warrantyId": complaint["WarrantyId"],
            "serialNumber": complaint["SerialNumber"],
            "description": complaint["Description"],
            "loggedBy": complaint.get("LoggedBy", complaint.get("UserId", "Service Desk")),
            "priority": complaint["Priority"],
            "status": complaint["Status"],
            "assignedTo": complaint.get("AssignedTo"),
            "notes": complaint.get("Notes", []),
            "attachmentCount": len(complaint.get("AttachmentPaths", [])),
            "resolutionNotes": complaint.get("ResolutionNotes"),
            "resolvedAt": complaint.get("ResolvedAt"),
            "createdAt": complaint["CreatedAt"],
            "updatedAt": complaint["UpdatedAt"],
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.put("/complaints/{complaint_id}", response_model=ApiResponse)
async def update_complaint_endpoint(
    complaint_id: str,
    request: Request,
    description: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    assignedTo: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    noteBy: Optional[str] = Form(None),
    complaint_status: Optional[str] = Form(None, alias="status"),
    resolutionNotes: Optional[str] = Form(None),
    attachments: Optional[List[UploadFile]] = File(None),
):
    """Update complaint with optional attachments"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Get existing complaint
    complaint = await get_complaint(user_id, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    if str(complaint.get("Status", "")).upper() == "RESOLVED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resolved complaints cannot be updated"
        )
    
    # Handle new file uploads
    attachment_paths = complaint.get("AttachmentPaths", []).copy()
    if attachments:
        try:
            for attachment in attachments:
                upload_dir = os.path.join(settings.LOCAL_UPLOAD_DIR, "attachments", user_id, complaint_id)
                os.makedirs(upload_dir, exist_ok=True)
                
                file_path = os.path.join(upload_dir, attachment.filename)
                contents = await attachment.read()
                
                with open(file_path, "wb") as f:
                    f.write(contents)
                
                attachment_paths.append(file_path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File upload failed: {str(e)}"
            )
    
    # Update complaint
    update_data = {}
    if description:
        update_data["description"] = description
    if priority:
        update_data["priority"] = priority
    if assignedTo is not None:
        update_data["assignedTo"] = assignedTo or None
        update_data["noteBy"] = noteBy or "Service Desk"
    if complaint_status:
        update_data["status"] = complaint_status.strip().upper().replace(" ", "_")
    if resolutionNotes:
        update_data["resolutionNotes"] = resolutionNotes
    if note and note.strip():
        update_data["note"] = {
            "text": note.strip(),
            "at": datetime.utcnow().isoformat(),
            "by": noteBy or "Service Desk",
        }
    if attachments:
        update_data["attachmentPaths"] = attachment_paths
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated_complaint = await db_update_complaint(user_id, complaint_id, update_data)
    
    return ApiResponse(
        success=True,
        data={
            "complaintId": updated_complaint["EntityId"],
            "warrantyId": updated_complaint["WarrantyId"],
            "serialNumber": updated_complaint["SerialNumber"],
            "description": updated_complaint["Description"],
            "loggedBy": updated_complaint.get("LoggedBy", updated_complaint.get("UserId", "Service Desk")),
            "priority": updated_complaint["Priority"],
            "status": updated_complaint["Status"],
            "assignedTo": updated_complaint.get("AssignedTo"),
            "notes": updated_complaint.get("Notes", []),
            "updatedAt": updated_complaint["UpdatedAt"],
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.put("/complaints/{complaint_id}/resolve", response_model=ApiResponse)
async def resolve_complaint_endpoint(
    complaint_id: str,
    request: Request,
    status_update: Optional[str] = Form("RESOLVED"),
    resolutionNotes: Optional[str] = Form(None),
    noteBy: Optional[str] = Form(None),
):
    """Mark complaint as resolved"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Get existing complaint
    complaint = await get_complaint(user_id, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found"
        )
    
    # Update complaint
    update_data = {
        "status": status_update.strip().upper().replace(" ", "_") if status_update else "RESOLVED",
        "resolutionNotes": resolutionNotes or "",
    }
    if resolutionNotes and resolutionNotes.strip():
        update_data["note"] = {
            "text": resolutionNotes.strip(),
            "at": datetime.utcnow().isoformat(),
            "by": noteBy or "Service Desk",
        }
    
    updated_complaint = await db_update_complaint(user_id, complaint_id, update_data)
    
    return ApiResponse(
        success=True,
        data={
            "complaintId": updated_complaint["EntityId"],
            "status": updated_complaint["Status"],
            "assignedTo": updated_complaint.get("AssignedTo"),
            "notes": updated_complaint.get("Notes", []),
            "resolutionNotes": updated_complaint.get("ResolutionNotes"),
            "updatedAt": updated_complaint["UpdatedAt"],
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )
