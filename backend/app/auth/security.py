from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.config.settings import Settings
from app.utils.errors import AppError

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

_hasher = PasswordHasher()
_TIMING_PLACEHOLDER_HASH = _hasher.hash("timing-placeholder-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def timing_placeholder_hash() -> str:
    return _TIMING_PLACEHOLDER_HASH


def _encode(user_id: int, token_type: str, lifetime: timedelta, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + lifetime}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, settings: Settings) -> str:
    return _encode(user_id, ACCESS_TOKEN_TYPE, timedelta(minutes=settings.access_token_minutes), settings)


def create_refresh_token(user_id: int, settings: Settings) -> str:
    return _encode(user_id, REFRESH_TOKEN_TYPE, timedelta(days=settings.refresh_token_days), settings)


def decode_user_id(token: str, token_type: str, settings: Settings) -> int:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError as error:
        raise AppError(401, "Your session has expired. Please sign in again.") from error
    if claims.get("type") != token_type:
        raise AppError(401, "Your session has expired. Please sign in again.")
    return int(claims["sub"])
