from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.main import create_app


def preflight(client: TestClient, origin: str):
    return client.options(
        "/api/products",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


def test_cors_allows_localhost_dev_origin(client: TestClient):
    response = preflight(client, "http://localhost:4300")

    assert response.headers.get("access-control-allow-origin") == "http://localhost:4300"


def test_cors_allows_loopback_ip_dev_origin_on_any_port(client: TestClient):
    response = preflight(client, "http://127.0.0.1:4200")

    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:4200"


def test_cors_allows_credentials_for_cookie_based_refresh(client: TestClient):
    response = preflight(client, "http://127.0.0.1:4300")

    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_refuses_unrelated_origin(client: TestClient):
    response = preflight(client, "https://evil.example")

    assert "access-control-allow-origin" not in response.headers


def test_cors_uses_only_the_configured_origins_when_regex_is_disabled(settings: Settings):
    strict = settings.model_copy(update={"cors_origin_regex": None, "cors_origins": ["https://shop.example.com"]})
    with TestClient(create_app(strict)) as client:
        assert preflight(client, "https://shop.example.com").headers.get("access-control-allow-origin") == "https://shop.example.com"
        assert "access-control-allow-origin" not in preflight(client, "http://localhost:4300").headers


def test_cors_allows_patch_requests_used_by_admin_and_cart_updates(client: TestClient):
    response = client.options(
        "/api/admin/orders/1/status",
        headers={"Origin": "http://localhost:4300", "Access-Control-Request-Method": "PATCH"},
    )

    assert "PATCH" in response.headers.get("access-control-allow-methods", "")
