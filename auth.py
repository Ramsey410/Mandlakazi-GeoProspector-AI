"""
Phase 8: JWT Authentication & User Management
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import os
import hmac
import secrets
import uuid
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from passlib.context import CryptContext
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from database import User, APIKey, get_session

# Security configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))


def get_secret_key(secret_key: Optional[str] = None) -> str:
    """Return a configured JWT key, rejecting missing and placeholder values."""
    key = secret_key if secret_key is not None else os.getenv("SECRET_KEY")
    if not key or len(key.encode("utf-8")) < 32:
        raise RuntimeError("SECRET_KEY must be configured with at least 32 bytes")
    if any(marker in key.lower() for marker in ("your-", "change", "example", "placeholder")):
        raise RuntimeError("SECRET_KEY must not be a placeholder value")
    return key


def validate_secret_key() -> None:
    """Fail application startup when JWT signing is not securely configured."""
    get_secret_key()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

class RateLimiter:
    """Simple in-memory rate limiter"""

    def __init__(self, requests_per_minute: int = 10):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(deque)
        self.lock = Lock()

    def is_allowed(self, client_id: str) -> bool:
        """Check if client is within rate limit"""
        now = monotonic()
        minute_ago = now - 60
        with self.lock:
            requests = self.requests[client_id]
            while requests and requests[0] <= minute_ago:
                requests.popleft()
            if len(requests) >= self.requests_per_minute:
                return False
            requests.append(now)
            return True

limiter = RateLimiter(requests_per_minute=10)

async def check_rate_limit(request: Request) -> None:
    """Check rate limit dependency"""
    client_id = request.client.host if request.client else "unknown"
    if not limiter.is_allowed(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: 10 requests per minute"
        )

# ============================================================================
# PASSWORD HASHING
# ============================================================================

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

# ============================================================================
# JWT TOKEN MANAGEMENT
# ============================================================================

def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        user_id: UUID of the user
        expires_delta: Token expiration time
        
    Returns:
        JWT token string
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(user_id: str) -> str:
    """Create refresh token (longer expiration)"""
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    
    encoded_jwt = jwt.encode(to_encode, get_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """
    Verify JWT token and extract payload
    
    Args:
        token: JWT token string
        
    Returns:
        Token payload dictionary
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# ============================================================================
# DEPENDENCY INJECTORS
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_session)) -> User:
    """
    Get current authenticated user from JWT token
    
    Used as FastAPI dependency:
    @app.get("/profile")
    async def get_profile(user: User = Depends(get_current_user)):
        return user
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user

async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """Require admin role"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user

async def get_analyst_or_admin(user: User = Depends(get_current_user)) -> User:
    """Require analyst or admin role"""
    if user.role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst access required"
        )
    return user

async def verify_api_key(api_key: str, db: Session = Depends(get_session)) -> User:
    """
    Verify API key and return associated user
    
    Used for programmatic access
    """
    from passlib.context import CryptContext
    
    # Hash the provided key and check against database
    key_entry = db.query(APIKey).filter(
        APIKey.is_active == True
    ).first()
    
    if key_entry is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Verify key
    pwd_ctx = CryptContext(schemes=["bcrypt"])
    if not pwd_ctx.verify(api_key, key_entry.key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    # Update last used
    key_entry.last_used = datetime.utcnow()
    db.commit()
    
    # Return associated user
    user = db.query(User).filter(User.id == key_entry.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive"
        )
    
    return user

# ============================================================================
# AUTHENTICATION SCHEMAS (Pydantic)
# ============================================================================

from pydantic import BaseModel, EmailStr
from typing import Literal

class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class UserRegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None
    organization: Optional[str] = None

class UserLoginRequest(BaseModel):
    """User login request"""
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str
    portal: Literal["client", "analyst"] = "client"

class AnalystRegisterRequest(UserRegisterRequest):
    registration_code: str

class UserProfile(BaseModel):
    """User profile response"""
    id: str
    email: str
    username: str
    full_name: Optional[str]
    organization: Optional[str]
    role: str
    created_at: datetime
    last_login: Optional[datetime]

class ChangePasswordRequest(BaseModel):
    """Change password request"""
    current_password: str
    new_password: str


def _public_user(user: User) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        organization=user.organization,
        role=user.role,
        created_at=user.created_at,
        last_login=user.last_login,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_rate_limit)])
async def register(request: UserRegisterRequest):
    """Create a client account and return its access tokens."""
    if len(request.password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if len(request.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    db = get_session()
    try:
        if db.query(User).filter((User.email == request.email.lower()) | (User.username == request.username.strip())).first():
            raise HTTPException(status_code=409, detail="Email or username is already registered")
        user = User(
            email=request.email.lower(),
            username=request.username.strip(),
            password_hash=hash_password(request.password),
            full_name=request.full_name,
            organization=request.organization,
            role="client",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    finally:
        db.close()


@router.post("/register/analyst", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_rate_limit)])
async def register_analyst(request: AnalystRegisterRequest):
    """Create an allowlisted analyst account only with an invitation code."""
    registration_code = os.getenv("ANALYST_REGISTRATION_CODE")
    if not registration_code:
        raise HTTPException(status_code=503, detail="Analyst registration is not configured")
    if not hmac.compare_digest(request.registration_code, registration_code):
        raise HTTPException(status_code=403, detail="Invalid analyst invitation code")
    allowed_emails = {
        value.strip().lower()
        for value in os.getenv("ANALYST_REGISTRATION_EMAILS", "").split(";")
        if value.strip()
    }
    if not allowed_emails:
        raise HTTPException(status_code=503, detail="Analyst registration allowlist is not configured")
    if request.email.lower() not in allowed_emails:
        raise HTTPException(status_code=403, detail="This email is not authorized for analyst registration")
    if len(request.password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if len(request.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    db = get_session()
    try:
        email = request.email.lower()
        username = request.username.strip()
        if db.query(User).filter((User.email == email) | (User.username == username)).first():
            raise HTTPException(status_code=409, detail="Email or username is already registered")
        user = User(
            email=email,
            username=username,
            password_hash=hash_password(request.password),
            full_name=request.full_name,
            organization=request.organization,
            role="analyst",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    finally:
        db.close()


@router.post("/google", response_model=TokenResponse, dependencies=[Depends(check_rate_limit)])
async def google_login(request: GoogleLoginRequest):
    """Verify a Google ID token and sign in or create a client account."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    try:
        claims = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            audience=client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = claims.get("email", "").lower()
    if not email or claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="A verified Google email is required")

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            if request.portal == "analyst":
                raise HTTPException(status_code=403, detail="No analyst account exists for this Google email")
            user = User(
                email=email,
                username=f"client_{uuid.uuid4().hex[:16]}",
                password_hash=hash_password(secrets.token_urlsafe(48)),
                full_name=claims.get("name"),
                role="client",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
        elif not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        elif request.portal == "analyst" and user.role not in {"analyst", "admin"}:
            raise HTTPException(status_code=403, detail="This Google account is not registered as an analyst")

        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    finally:
        db.close()


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(check_rate_limit)])
async def login(request: UserLoginRequest):
    """Authenticate a user account."""
    db = get_session()
    try:
        user = db.query(User).filter(User.email == request.email.lower()).first()
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        user.last_login = datetime.utcnow()
        db.commit()
        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    finally:
        db.close()


@router.get("/me", response_model=UserProfile)
async def current_profile(user: User = Depends(get_current_user)):
    return _public_user(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(request: ChangePasswordRequest, user: User = Depends(get_current_user)):
    if len(request.new_password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    db = get_session()
    try:
        stored_user = db.query(User).filter(User.id == user.id).one()
        stored_user.password_hash = hash_password(request.new_password)
        db.commit()
    finally:
        db.close()

# ============================================================================
# INPUT VALIDATION
# ============================================================================

def validate_polygon_size(area_km2: float, max_area: float = 10000):
    """Validate polygon size"""
    if area_km2 > max_area:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Polygon area ({area_km2:.0f} km²) exceeds maximum ({max_area} km²)"
        )

def validate_polygon_vertices(num_vertices: int, max_vertices: int = 1000):
    """Validate polygon vertex count"""
    if num_vertices > max_vertices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Polygon has {num_vertices} vertices, maximum is {max_vertices}"
        )

def validate_mineral_type(mineral: str, allowed_minerals: list = None):
    """Validate mineral type"""
    if allowed_minerals is None:
        allowed_minerals = ['gold', 'copper', 'lithium', 'rare_earths', 'coal', 'graphite']
    
    if mineral.lower() not in allowed_minerals:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported mineral type: {mineral}. Allowed: {', '.join(allowed_minerals)}"
        )
