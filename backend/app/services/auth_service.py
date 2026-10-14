from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_user_id,
    hash_password,
    timing_placeholder_hash,
    verify_password,
    REFRESH_TOKEN_TYPE,
)
from app.config.settings import Settings
from app.models.user import Role, User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import SignUpRequest
from app.utils.errors import AppError

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."
DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists."
SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again."


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    def __init__(self, session: Session, settings: Settings):
        self._session = session
        self._settings = settings
        self._users = UserRepository(session)

    def sign_up(self, request: SignUpRequest) -> User:
        email = request.email.lower()
        if self._users.get_by_email(email):
            raise AppError(409, DUPLICATE_EMAIL_MESSAGE)

        role = Role.ADMIN if email in self._settings.admin_emails else Role.CUSTOMER
        user = User(
            full_name=request.full_name,
            email=email,
            phone=request.phone,
            password_hash=hash_password(request.password),
            role=role.value,
        )
        self._users.add(user)
        try:
            self._session.commit()
        except IntegrityError as error:
            self._session.rollback()
            raise AppError(409, DUPLICATE_EMAIL_MESSAGE) from error
        return user

    def authenticate(self, email: str, password: str) -> User:
        user = self._users.get_by_email(email.lower())
        password_hash = user.password_hash if user else timing_placeholder_hash()
        password_matches = verify_password(password_hash, password)
        if user is None or not password_matches or not user.is_active:
            raise AppError(401, INVALID_CREDENTIALS_MESSAGE)
        return user

    def issue_tokens(self, user: User) -> IssuedTokens:
        return IssuedTokens(
            access_token=create_access_token(user.id, self._settings),
            refresh_token=create_refresh_token(user.id, self._settings),
            expires_in=self._settings.access_token_minutes * 60,
        )

    def user_for_refresh_token(self, refresh_token: str) -> User:
        user_id = decode_user_id(refresh_token, REFRESH_TOKEN_TYPE, self._settings)
        return self.active_user(user_id)

    def active_user(self, user_id: int) -> User:
        user = self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise AppError(401, SESSION_EXPIRED_MESSAGE)
        return user
