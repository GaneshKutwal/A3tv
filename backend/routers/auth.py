"""Authentication routes."""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime

from models.request import LoginRequest
from models.response import ApiResponse
from auth import validate_credentials, create_access_token

router = APIRouter()


@router.post("/auth/login", response_model=ApiResponse)
async def login(request: LoginRequest):
    user = validate_credentials(request.username, request.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return ApiResponse(
        success=True,
        data={
            "accessToken": create_access_token(user["userId"], user["email"]),
            "tokenType": "Bearer",
            "expiresIn": 86400,
            "user": {
                "userId": user["userId"],
                "email": user["email"],
                "name": user["name"],
            },
        },
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.post("/auth/logout", response_model=ApiResponse)
async def logout():
    """Cognito logout is handled by the frontend by clearing its token."""
    return ApiResponse(
        success=True,
        data=None,
        error=None,
        timestamp=datetime.utcnow().isoformat(),
    )

