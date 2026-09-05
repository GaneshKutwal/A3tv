"""Authentication routes"""
from fastapi import APIRouter, HTTPException, status, Header
from datetime import datetime, timedelta
from typing import Optional
import uuid

from models.request import LoginRequest
from models.response import ApiResponse, LoginResponse
from auth import validate_credentials, create_access_token, verify_token, get_token_from_header
from config import settings

router = APIRouter()

@router.post("/auth/login", response_model=ApiResponse)
async def login(request: LoginRequest):
    """
    Login endpoint - validates credentials and returns JWT token
    
    Predefined users:
    - employee1@a3tv.com / password123
    - employee2@a3tv.com / password456
    """
    user = validate_credentials(request.username, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Create JWT token
    access_token = create_access_token(user["userId"], user["email"])
    expires_in = settings.JWT_EXPIRATION_HOURS * 3600
    
    response_data = LoginResponse(
        accessToken=access_token,
        tokenType="Bearer",
        expiresIn=expires_in,
        user={
            "userId": user["userId"],
            "email": user["email"],
            "name": user["name"],
        }
    )
    
    return ApiResponse(
        success=True,
        data=response_data.model_dump(),
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.post("/auth/logout", response_model=ApiResponse)
async def logout(authorization: Optional[str] = Header(None)):
    """
    Logout endpoint - invalidates session (stateless, token is removed on client)
    """
    token = get_token_from_header(authorization) if authorization else None
    
    if not token or not verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized"
        )
    
    return ApiResponse(
        success=True,
        data=None,
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.post("/auth/refresh", response_model=ApiResponse)
async def refresh_token(authorization: Optional[str] = Header(None)):
    """
    Refresh JWT token
    """
    token = get_token_from_header(authorization) if authorization else None
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized"
        )
    
    claims = verify_token(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    # Issue new token
    new_token = create_access_token(claims["user_id"], claims["email"])
    expires_in = settings.JWT_EXPIRATION_HOURS * 3600
    
    return ApiResponse(
        success=True,
        data={
            "accessToken": new_token,
            "tokenType": "Bearer",
            "expiresIn": expires_in,
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )
