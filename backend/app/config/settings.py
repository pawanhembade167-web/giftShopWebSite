from functools import lru_cache
from pathlib import Path

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_PATH = BACKEND_DIR / "data" / "echomart.db"
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ECHOMART_", env_file=ENV_FILE, extra="ignore")

    database_url: str = f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}"
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=15, ge=1)
    refresh_token_days: int = Field(default=7, ge=1)
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:4300", "http://localhost:4200"]
    # Development default: any localhost or 127.0.0.1 port. Set to empty for production.
    cors_origin_regex: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    admin_emails: list[str] = []

    # Source prices in the catalog CSV are US dollars. Assumed rate; set ECHOMART_USD_TO_INR_RATE to the current rate.
    usd_to_inr_rate: float = Field(default=83.0, gt=0)

    rec_content_weight: float = Field(default=0.35, ge=0)
    rec_collaborative_weight: float = Field(default=0.35, ge=0)
    rec_popularity_weight: float = Field(default=0.20, ge=0)
    rec_recency_weight: float = Field(default=0.10, ge=0)
    rec_min_active_users: int = Field(default=20, ge=1)
    rec_cache_seconds: int = Field(default=300, ge=0)

    @field_validator("admin_emails", mode="after")
    @classmethod
    def normalise_admin_emails(cls, emails: list[str]) -> list[str]:
        return [email.strip().lower() for email in emails if email.strip()]


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as error:
        missing = [".".join(str(part) for part in item["loc"]) for item in error.errors() if item["type"] == "missing"]
        if "jwt_secret" in missing:
            raise SystemExit(
                "ECHOMART_JWT_SECRET is not set. Copy backend/.env.example to backend/.env "
                "and set a random secret of at least 32 characters."
            ) from error
        raise
