from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text

from app.auth.security import create_access_token
from app.config.settings import Settings
from tests.conftest import TEST_JWT_SECRET

SIGNUP_PATH = "/api/auth/signup"
LOGIN_PATH = "/api/auth/login"
ME_PATH = "/api/auth/me"
REFRESH_PATH = "/api/auth/refresh"
LOGOUT_PATH = "/api/auth/logout"
REFRESH_COOKIE = "echomart_refresh"


def new_user(**overrides) -> dict:
    payload = {
        "fullName": "Ravi Kumar",
        "email": "ravi@example.com",
        "phone": "9876543210",
        "password": "Secret123",
    }
    payload.update(overrides)
    return payload


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_signup_valid_payload_returns_created_user_without_password(client: TestClient):
    response = client.post(SIGNUP_PATH, json=new_user())

    body = response.json()
    assert response.status_code == 201
    assert body["success"] is True
    assert body["data"]["user"]["email"] == "ravi@example.com"
    assert body["data"]["user"]["role"] == "CUSTOMER"
    assert "password" not in body["data"]["user"]


def test_signup_duplicate_email_returns_409(client: TestClient, signed_up_user: dict):
    response = client.post(SIGNUP_PATH, json=new_user(email=signed_up_user["email"]))

    assert response.status_code == 409
    assert response.json()["success"] is False


def test_signup_email_differing_only_in_case_returns_409(client: TestClient, signed_up_user: dict):
    response = client.post(SIGNUP_PATH, json=new_user(email="ASHA@Example.com"))

    assert response.status_code == 409


def test_signup_weak_password_returns_422_with_password_field_error(client: TestClient):
    response = client.post(SIGNUP_PATH, json=new_user(password="short"))

    body = response.json()
    assert response.status_code == 422
    assert body["success"] is False
    assert any(error["field"] == "password" for error in body["errors"])


def test_signup_invalid_phone_returns_422_with_phone_field_error(client: TestClient):
    response = client.post(SIGNUP_PATH, json=new_user(phone="12ab"))

    assert response.status_code == 422
    assert any(error["field"] == "phone" for error in response.json()["errors"])


def test_signup_stores_password_as_argon2_hash_not_plaintext(client: TestClient, settings: Settings):
    client.post(SIGNUP_PATH, json=new_user())

    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        stored = connection.execute(text("SELECT password_hash FROM users")).scalar_one()
    engine.dispose()

    assert stored.startswith("$argon2")
    assert "Secret123" not in stored


def test_signup_email_in_admin_list_gets_admin_role(client: TestClient):
    response = client.post(SIGNUP_PATH, json=new_user(email="owner@example.com"))

    assert response.json()["data"]["user"]["role"] == "ADMIN"


def test_login_correct_credentials_returns_access_token_and_refresh_cookie(client: TestClient, signed_up_user: dict):
    response = client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": signed_up_user["password"]})

    body = response.json()
    assert response.status_code == 200
    assert body["data"]["tokenType"] == "bearer"
    assert body["data"]["accessToken"]
    assert body["data"]["user"]["email"] == signed_up_user["email"]
    assert REFRESH_COOKIE in response.cookies


def test_login_wrong_password_returns_401_generic_message(client: TestClient, signed_up_user: dict):
    response = client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": "Wrong1234"})

    assert response.status_code == 401
    assert response.json()["message"] == "Invalid email or password."


def test_login_unknown_email_returns_same_401_message_as_wrong_password(client: TestClient):
    response = client.post(LOGIN_PATH, json={"email": "nobody@example.com", "password": "Secret123"})

    assert response.status_code == 401
    assert response.json()["message"] == "Invalid email or password."


def test_me_with_valid_access_token_returns_current_user(client: TestClient, signed_up_user: dict):
    token = client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": signed_up_user["password"]}).json()["data"]["accessToken"]

    response = client.get(ME_PATH, headers=bearer(token))

    assert response.status_code == 200
    assert response.json()["data"]["user"]["fullName"] == signed_up_user["fullName"]


def test_me_without_token_returns_401(client: TestClient):
    response = client.get(ME_PATH)

    assert response.status_code == 401


def test_me_with_expired_token_returns_401(client: TestClient, settings: Settings):
    expired = jwt.encode(
        {"sub": "1", "type": "access", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get(ME_PATH, headers=bearer(expired))

    assert response.status_code == 401


def test_me_with_refresh_token_as_bearer_returns_401(client: TestClient, signed_up_user: dict):
    client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": signed_up_user["password"]})
    refresh = client.cookies.get(REFRESH_COOKIE)

    response = client.get(ME_PATH, headers=bearer(refresh))

    assert response.status_code == 401


def test_refresh_with_login_cookie_returns_new_access_token(client: TestClient, signed_up_user: dict):
    client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": signed_up_user["password"]})

    response = client.post(REFRESH_PATH)

    assert response.status_code == 200
    assert response.json()["data"]["accessToken"]


def test_refresh_without_cookie_returns_401(client: TestClient):
    response = client.post(REFRESH_PATH)

    assert response.status_code == 401


def test_logout_clears_refresh_cookie(client: TestClient, signed_up_user: dict):
    client.post(LOGIN_PATH, json={"email": signed_up_user["email"], "password": signed_up_user["password"]})

    response = client.post(LOGOUT_PATH)

    set_cookie = response.headers.get("set-cookie", "")
    assert response.status_code == 200
    assert REFRESH_COOKIE in set_cookie
    assert "Max-Age=0" in set_cookie


def test_access_token_for_deleted_user_returns_401(client: TestClient, settings: Settings):
    token = create_access_token(user_id=999, settings=settings)

    response = client.get(ME_PATH, headers=bearer(token))

    assert response.status_code == 401
