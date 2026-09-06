"""Local development auth and production API Gateway claims."""
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, status
from jose import jwt
from config import settings


LOCAL_USERS = {
    "employee1@a3tv.com": {
        "userId": "user-001",
        "name": "Employee One",
        "email": "employee1@a3tv.com",
        "password": "password123",
    },
    "employee2@a3tv.com": {
        "userId": "user-002",
        "name": "Employee Two",
        "email": "employee2@a3tv.com",
        "password": "password456",
    },
}


def validate_credentials(username: str, password: str) -> Optional[Dict[str, str]]:
    if settings.ENVIRONMENT != "local":
        return None
    user = LOCAL_USERS.get(username)
    return user if user and user["password"] == password else None


def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
            "iat": datetime.utcnow(),
        },
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def _get_local_token(request: Request) -> Optional[str]:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    return token if scheme.lower() == "bearer" and token else None


def _verify_local_token(token: str) -> Optional[Dict[str, str]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if not payload.get("sub"):
            return None
        return {"user_id": payload["sub"], "email": payload.get("email", "")}
    except jwt.JWTError:
        return None


def get_current_user(request: Request) -> Dict[str, Any]:
    """Use local JWTs only in local mode; production trusts API Gateway claims."""
    if settings.ENVIRONMENT == "local":
        token = _get_local_token(request)
        claims = _verify_local_token(token) if token else None
        if claims:
            return claims
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    event = request.scope.get("aws.event", {})
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims") or {}

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    return {
        "user_id": user_id,
        "email": claims.get("email") or claims.get("cognito:username") or "",
        "username": claims.get("cognito:username") or claims.get("username") or "",
    }
