from datetime import datetime, timedelta
from typing import Optional, Dict
from passlib.context import CryptContext
from jose import JWTError, jwt
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is required")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Fixed demo user configuration
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo123"
DEMO_USER = {
    "username": DEMO_USERNAME,
    "hashed_password": CryptContext(schemes=["bcrypt"], deprecated="auto").hash(DEMO_PASSWORD)
}

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        print(f"JWT decode error: {str(e)}")
        print(f"Token: {token[:10]}...")  # Log first 10 chars for debugging
        print(f"Secret key: {SECRET_KEY[:10]}...")  # Log first 10 chars of secret
        return None

USERS = {DEMO_USERNAME: DEMO_USER}

def get_user(username: str) -> Optional[dict]:
    """Retrieve a user by username."""
    return USERS.get(username)

def create_user(username: str, password: str) -> bool:
    """Create a new user with the given username and password."""
    if username in USERS:
        return False
    
    USERS[username] = {
        "username": username,
        "hashed_password": hash_password(password)
    }
    return True
