"""Analytics and dashboard routes"""
from fastapi import APIRouter, HTTPException, status, Header, Query
from datetime import datetime
from typing import Optional

from models.response import ApiResponse
from auth import verify_token, get_token_from_header
from database import get_dashboard_stats

router = APIRouter()

def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current authenticated user"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
    
    token = get_token_from_header(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )
    
    claims = verify_token(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return claims

@router.get("/dashboard/stats", response_model=ApiResponse)
async def get_dashboard_statistics(
    authorization: Optional[str] = Header(None),
):
    """Get dashboard summary statistics"""
    
    # Verify authentication
    claims = get_current_user(authorization)
    user_id = claims["user_id"]
    
    # Get statistics
    stats = await get_dashboard_stats(user_id)
    
    return ApiResponse(
        success=True,
        data=stats,
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )
