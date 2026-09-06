"""Analytics and dashboard routes"""
from fastapi import APIRouter, Request
from datetime import datetime
from typing import Optional

from models.response import ApiResponse
from auth import get_current_user
from database import get_dashboard_stats

router = APIRouter()

@router.get("/dashboard/stats", response_model=ApiResponse)
async def get_dashboard_statistics(
    request: Request,
):
    """Get dashboard summary statistics"""
    
    # Verify authentication
    claims = get_current_user(request)
    user_id = claims["user_id"]
    
    # Get statistics
    stats = await get_dashboard_stats(user_id)
    
    return ApiResponse(
        success=True,
        data=stats,
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )
