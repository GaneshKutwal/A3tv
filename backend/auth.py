"""Authentication utilities for local JWT and Cognito access tokens."""
from datetime import datetime, timedelta
import json
from threading import Lock
from urllib.request import urlopen
from jose import jwt
from typing import Optional, Dict
from config import settings
import logging

logger = logging.getLogger(__name__)

_cognito_keys: Optional[Dict] = None
_cognito_keys_lock = Lock()

# Predefined users for local development
PREDEFINED_USERS = {
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

def validate_credentials(username: str, password: str) -> Optional[Dict]:
    """Validate user credentials against predefined users"""
    user = PREDEFINED_USERS.get(username)
    if user and user["password"] == password:
        return user
    return None

def create_access_token(user_id: str, email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    to_encode = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict]:
    """Verify a Cognito token in AWS or the local HS256 token during development."""
    if settings.COGNITO_USER_POOL_ID:
        cognito_claims = _verify_cognito_token(token)
        if cognito_claims:
            return cognito_claims

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        if user_id is None:
            return None
        return {"user_id": user_id, "email": email}
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        return None
    except jwt.JWTError:
        logger.warning("Invalid token")
        return None

def _cognito_issuer() -> str:
    return f"https://cognito-idp.{settings.AWS_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"

def _get_cognito_keys() -> Dict:
    global _cognito_keys
    if _cognito_keys is None:
        with _cognito_keys_lock:
            if _cognito_keys is None:
                with urlopen(f"{_cognito_issuer()}/.well-known/jwks.json", timeout=5) as response:
                    _cognito_keys = json.load(response)
    return _cognito_keys

def _verify_cognito_token(token: str) -> Optional[Dict]:
    try:
        header = jwt.get_unverified_header(token)
        key = next(key for key in _get_cognito_keys()["keys"] if key["kid"] == header["kid"])
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=_cognito_issuer(),
            options={"verify_aud": False},
        )
        if payload.get("token_use") not in {"access", "id"}:
            return None
        if settings.COGNITO_CLIENT_ID:
            token_client_id = payload.get("client_id") or payload.get("aud")
            if token_client_id != settings.COGNITO_CLIENT_ID:
                return None
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email") or payload.get("username"),
        }
    except (StopIteration, KeyError, ValueError, OSError, jwt.JWTError) as error:
        logger.warning("Cognito token validation failed: %s", error)
        return None

def get_token_from_header(auth_header: str) -> Optional[str]:
    """Extract JWT token from Authorization header"""
    if not auth_header:
        return None
    
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]
