from collections.abc import Iterator

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import ACCESS_TOKEN_TYPE, decode_user_id
from app.config.settings import Settings
from app.models.user import User
from app.schemas.auth import LoginRequest, SignUpRequest, UserOut
from app.services.auth_service import AuthService
from app.utils.errors import AppError

router = APIRouter(prefix="/api/auth", tags=["auth"])
REFRESH_COOKIE_NAME = "echomart_refresh"
REFRESH_COOKIE_PATH = "/api/auth"
SECONDS_PER_DAY = 86400
bearer_scheme = HTTPBearer(auto_error=False)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db_session(request: Request) -> Iterator[Session]:
    session: Session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def get_auth_service(
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> AuthService:
    return AuthService(session, settings)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None:
        raise AppError(401, "Please sign in to continue.")
    user_id = decode_user_id(credentials.credentials, ACCESS_TOKEN_TYPE, settings)
    return service.active_user(user_id)


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> User | None:
    if credentials is None:
        return None
    user_id = decode_user_id(credentials.credentials, ACCESS_TOKEN_TYPE, settings)
    return service.active_user(user_id)


def _envelope(data: dict, message: str) -> dict:
    return {"success": True, "data": data, "message": message}


def _user_payload(user: User) -> dict:
    return UserOut.model_validate(user).model_dump(by_alias=True)


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        max_age=settings.refresh_token_days * SECONDS_PER_DAY,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/signup", status_code=201)
def signup(body: SignUpRequest, service: AuthService = Depends(get_auth_service)) -> dict:
    user = service.sign_up(body)
    return _envelope({"user": _user_payload(user)}, "Account created successfully.")


@router.post("/login")
def login(
    body: LoginRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> dict:
    user = service.authenticate(body.email, body.password)
    tokens = service.issue_tokens(user)
    _set_refresh_cookie(response, tokens.refresh_token, settings)
    return _envelope(
        {
            "accessToken": tokens.access_token,
            "tokenType": "bearer",
            "expiresIn": tokens.expires_in,
            "user": _user_payload(user),
        },
        "Signed in successfully.",
    )


@router.post("/refresh")
def refresh(
    request: Request,
    service: AuthService = Depends(get_auth_service),
) -> dict:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise AppError(401, "Please sign in to continue.")
    user = service.user_for_refresh_token(refresh_token)
    tokens = service.issue_tokens(user)
    return _envelope(
        {
            "accessToken": tokens.access_token,
            "tokenType": "bearer",
            "expiresIn": tokens.expires_in,
            "user": _user_payload(user),
        },
        "Session refreshed.",
    )


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, samesite="lax")
    return _envelope({}, "Signed out successfully.")


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return _envelope({"user": _user_payload(user)}, "Profile fetched successfully.")
