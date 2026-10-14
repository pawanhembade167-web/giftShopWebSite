from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.config.settings import Settings
from tests.factories import add_product, admin, shopper

HAMPERS = "/api/hampers"
ADMIN_HAMPERS = "/api/admin/hampers"


def body(items: list[dict], **overrides) -> dict:
    data = {
        "title": "Birthday hamper for Priya",
        "occasion": "Birthday",
        "recipientName": "Priya",
        "message": "Happy birthday!",
        "budget": 2000,
        "deliveryDate": (date.today() + timedelta(days=30)).isoformat(),
        "giftWrap": True,
        "items": items,
    }
    data.update(overrides)
    return data


def test_creating_a_hamper_needs_a_signed_in_shopper(client: TestClient):
    assert client.post(HAMPERS, json=body([{"productId": 1, "quantity": 1}])).status_code == 401


def test_creating_a_hamper_saves_it_as_a_request_with_an_estimated_total(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    chocolate = add_product(client, 1, price=250.0, stock=10)
    candle = add_product(client, 2, price=125.0, stock=10)

    response = client.post(HAMPERS, json=body([
        {"productId": chocolate, "quantity": 2},
        {"productId": candle, "quantity": 1},
    ]), headers=buyer["headers"])

    hamper = response.json()["data"]["hamper"]
    assert response.status_code == 201
    assert hamper["status"] == "REQUESTED"
    assert hamper["estimatedTotal"] == 625.0
    assert len(hamper["items"]) == 2


def test_a_hamper_needs_at_least_one_item(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    response = client.post(HAMPERS, json=body([]), headers=buyer["headers"])

    assert response.status_code == 422


def test_a_hamper_cannot_include_an_unknown_or_hidden_product(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    hidden = add_product(client, 3, price=100.0, stock=5, active=False)

    unknown = client.post(HAMPERS, json=body([{"productId": 999, "quantity": 1}]), headers=buyer["headers"])
    hidden_response = client.post(HAMPERS, json=body([{"productId": hidden, "quantity": 1}]), headers=buyer["headers"])

    assert unknown.status_code == 404
    assert hidden_response.status_code == 404


def test_a_hamper_cannot_ask_for_more_than_is_in_stock(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 4, price=100.0, stock=2)

    response = client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 3}]), headers=buyer["headers"])

    assert response.status_code == 422
    assert "Only 2 left" in response.json()["message"]


def test_repeated_products_are_combined_into_one_line(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 5, price=100.0, stock=10)

    response = client.post(HAMPERS, json=body([
        {"productId": product_id, "quantity": 1},
        {"productId": product_id, "quantity": 2},
    ]), headers=buyer["headers"])

    hamper = response.json()["data"]["hamper"]
    assert hamper["items"] == [{"productId": product_id, "name": "Product 5", "unitPrice": 100.0, "quantity": 3, "lineTotal": 300.0}]


def test_a_shopper_sees_only_their_own_hampers(client: TestClient, settings: Settings):
    first = shopper(client, settings, "first@example.com")
    second = shopper(client, settings, "second@example.com")
    product_id = add_product(client, 6, price=100.0, stock=10)
    client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}]), headers=first["headers"])

    mine = client.get(HAMPERS, headers=first["headers"]).json()["data"]["hampers"]
    theirs = client.get(HAMPERS, headers=second["headers"]).json()["data"]["hampers"]

    assert len(mine) == 1
    assert theirs == []


def test_admin_sees_every_hamper_request(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    product_id = add_product(client, 7, price=100.0, stock=10)
    client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}]), headers=buyer["headers"])

    hampers = client.get(ADMIN_HAMPERS, headers=staff["headers"]).json()["data"]["hampers"]

    assert len(hampers) == 1
    assert hampers[0]["recipientName"] == "Priya"


def test_customers_cannot_see_the_admin_hamper_list(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    assert client.get(ADMIN_HAMPERS, headers=buyer["headers"]).status_code == 403
