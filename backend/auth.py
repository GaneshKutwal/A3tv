"""Authentication utilities"""
from datetime import datetime, timedelta
import jwt
from typing import Optional, Dict
from config import settings
import logging

logger = logging.getLogger(__name__)

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
    """Verify JWT token and extract claims"""
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
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        return None

def get_token_from_header(auth_header: str) -> Optional[str]:
    """Extract JWT token from Authorization header"""
    if not auth_header:
        return None
    
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    return parts[1]
