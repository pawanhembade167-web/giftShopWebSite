import pytest
from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app

TEST_JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-0123456789"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        jwt_secret=TEST_JWT_SECRET,
        admin_emails=["owner@example.com"],
        cookie_secure=False,
        rec_min_active_users=3,
        rec_cache_seconds=0,
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def signed_up_user(client: TestClient) -> dict:
    payload = {
        "fullName": "Asha Rao",
        "email": "asha@example.com",
        "phone": "+91 98765 43210",
        "password": "Secret123",
    }
    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return payload
