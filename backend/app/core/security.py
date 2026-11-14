from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"
MAX_PASSWORD_BYTES = 72
DUMMY_HASH = bcrypt.hashpw(b"no such account", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    """With no hash (unknown account) it still does the work, so timing does not reveal emails."""
    secret = password.encode()
    # bcrypt rejects more than 72 bytes with an error; such a password cannot be right.
    if len(secret) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(secret, (password_hash or DUMMY_HASH).encode()) and bool(password_hash)


def create_token(user_id: int, token_version: int) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=settings.jwt_expires_minutes)
    claims = {"sub": str(user_id), "ver": token_version, "exp": expires}
    return jwt.encode(claims, settings.jwt_secret, ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, [ALGORITHM])
    except jwt.PyJWTError:
        return None
