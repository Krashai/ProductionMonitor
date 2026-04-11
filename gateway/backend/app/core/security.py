import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

# SECRET_KEY MUST come from the environment. Hardcoding it (the previous
# behaviour) meant every gateway deployment shared the same JWT signing key
# and any leaked git history would compromise every install. We fail fast
# in production. In dev (when the env var is missing) we generate a random
# ephemeral key and warn loudly so the user knows their tokens won't survive
# a restart.
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    if os.environ.get("PLC_GATEWAY_ENV", "").lower() == "production":
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Refusing to start in production with "
            "an ephemeral signing key. Set JWT_SECRET_KEY in the environment."
        )
    SECRET_KEY = secrets.token_urlsafe(64)
    print(
        "WARNING: JWT_SECRET_KEY not set — generated an ephemeral key for this "
        "process. Tokens will be invalidated on restart. Set JWT_SECRET_KEY in "
        ".env for stable sessions.",
        flush=True,
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24h

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
