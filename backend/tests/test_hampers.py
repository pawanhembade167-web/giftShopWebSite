from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.config.settings import Settings
from tests.factories import add_address, add_product, admin, shopper, stock_of

HAMPERS = "/api/hampers"
ADMIN_HAMPERS = "/api/admin/hampers"
ADMIN_ORDERS = "/api/admin/orders"


def body(items: list[dict], address_id: int | None, **overrides) -> dict:
    data = {
        "title": "Birthday hamper for Priya",
        "occasion": "Birthday",
        "recipientName": "Priya",
        "message": "Happy birthday!",
        "budget": 2000,
        "deliveryDate": (date.today() + timedelta(days=30)).isoformat(),
        "giftWrap": True,
        "addressId": address_id,
        "items": items,
    }
    data.update(overrides)
    return data


def test_creating_a_hamper_needs_a_signed_in_shopper(client: TestClient):
    assert client.post(HAMPERS, json=body([{"productId": 1, "quantity": 1}], 1)).status_code == 401


def test_creating_a_hamper_saves_it_as_a_request_with_an_estimated_total(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    chocolate = add_product(client, 1, price=250.0, stock=10)
    candle = add_product(client, 2, price=125.0, stock=10)

    response = client.post(HAMPERS, json=body([
        {"productId": chocolate, "quantity": 2},
        {"productId": candle, "quantity": 1},
    ], address_id), headers=buyer["headers"])

    hamper = response.json()["data"]["hamper"]
    assert response.status_code == 201
    assert hamper["status"] == "REQUESTED"
    assert hamper["estimatedTotal"] == 625.0
    assert len(hamper["items"]) == 2


def test_a_hamper_needs_a_delivery_address(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=100.0, stock=10)

    response = client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}], None), headers=buyer["headers"])

    assert response.status_code == 422


def test_a_hamper_cannot_use_another_shoppers_address(client: TestClient, settings: Settings):
    owner = shopper(client, settings, "owner@example.com")
    other = shopper(client, settings, "other@example.com")
    someone_elses_address = add_address(client, owner["headers"])
    product_id = add_product(client, 2, price=100.0, stock=10)

    response = client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}], someone_elses_address),
                           headers=other["headers"])

    assert response.status_code == 404


def test_a_hamper_needs_at_least_one_item(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])

    response = client.post(HAMPERS, json=body([], address_id), headers=buyer["headers"])

    assert response.status_code == 422


def test_a_hamper_cannot_include_an_unknown_or_hidden_product(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    hidden = add_product(client, 3, price=100.0, stock=5, active=False)

    unknown = client.post(HAMPERS, json=body([{"productId": 999, "quantity": 1}], address_id), headers=buyer["headers"])
    hidden_response = client.post(HAMPERS, json=body([{"productId": hidden, "quantity": 1}], address_id), headers=buyer["headers"])

    assert unknown.status_code == 404
    assert hidden_response.status_code == 404


def test_a_hamper_cannot_ask_for_more_than_is_in_stock(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    product_id = add_product(client, 4, price=100.0, stock=2)

    response = client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 3}], address_id), headers=buyer["headers"])

    assert response.status_code == 422
    assert "Only 2 left" in response.json()["message"]


def test_repeated_products_are_combined_into_one_line(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    product_id = add_product(client, 5, price=100.0, stock=10)

    response = client.post(HAMPERS, json=body([
        {"productId": product_id, "quantity": 1},
        {"productId": product_id, "quantity": 2},
    ], address_id), headers=buyer["headers"])

    hamper = response.json()["data"]["hamper"]
    assert hamper["items"] == [{"productId": product_id, "name": "Product 5", "unitPrice": 100.0, "quantity": 3, "lineTotal": 300.0}]


def test_a_shopper_sees_only_their_own_hampers(client: TestClient, settings: Settings):
    first = shopper(client, settings, "first@example.com")
    second = shopper(client, settings, "second@example.com")
    address_id = add_address(client, first["headers"])
    product_id = add_product(client, 6, price=100.0, stock=10)
    client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}], address_id), headers=first["headers"])

    mine = client.get(HAMPERS, headers=first["headers"]).json()["data"]["hampers"]
    theirs = client.get(HAMPERS, headers=second["headers"]).json()["data"]["hampers"]

    assert len(mine) == 1
    assert theirs == []


def test_admin_sees_every_hamper_request(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    product_id = add_product(client, 7, price=100.0, stock=10)
    client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}], address_id), headers=buyer["headers"])

    hampers = client.get(ADMIN_HAMPERS, headers=staff["headers"]).json()["data"]["hampers"]

    assert len(hampers) == 1
    assert hampers[0]["recipientName"] == "Priya"


def test_customers_cannot_see_the_admin_hamper_list(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    assert client.get(ADMIN_HAMPERS, headers=buyer["headers"]).status_code == 403


def request_hamper(client: TestClient, settings: Settings, stock: int = 10) -> tuple[int, int, dict]:
    buyer = shopper(client, settings)
    address_id = add_address(client, buyer["headers"])
    product_id = add_product(client, 8, price=100.0, stock=stock)
    response = client.post(HAMPERS, json=body([{"productId": product_id, "quantity": 1}], address_id), headers=buyer["headers"])
    return response.json()["data"]["hamper"]["id"], product_id, buyer


def test_admin_can_accept_a_requested_hamper(client: TestClient, settings: Settings):
    hamper_id, _, buyer = request_hamper(client, settings)
    staff = admin(client, settings)

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=staff["headers"])

    assert response.status_code == 200
    assert response.json()["data"]["hamper"]["status"] == "ACCEPTED"
    mine = client.get(HAMPERS, headers=buyer["headers"]).json()["data"]["hampers"]
    assert mine[0]["status"] == "ACCEPTED"


def test_admin_can_reject_a_requested_hamper(client: TestClient, settings: Settings):
    hamper_id, _, _ = request_hamper(client, settings)
    staff = admin(client, settings)

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "REJECTED"}, headers=staff["headers"])

    assert response.status_code == 200
    assert response.json()["data"]["hamper"]["status"] == "REJECTED"


def test_a_hamper_that_is_already_decided_cannot_be_decided_again(client: TestClient, settings: Settings):
    hamper_id, _, _ = request_hamper(client, settings)
    staff = admin(client, settings)
    client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=staff["headers"])

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "REJECTED"}, headers=staff["headers"])

    assert response.status_code == 422
    assert "already" in response.json()["message"]


def test_a_hamper_status_must_be_accepted_or_rejected(client: TestClient, settings: Settings):
    hamper_id, _, _ = request_hamper(client, settings)
    staff = admin(client, settings)

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "DELIVERED"}, headers=staff["headers"])

    assert response.status_code == 422


def test_customers_cannot_change_a_hamper_status(client: TestClient, settings: Settings):
    hamper_id, _, buyer = request_hamper(client, settings)

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=buyer["headers"])

    assert response.status_code == 403


def test_changing_the_status_of_an_unknown_hamper_returns_not_found(client: TestClient, settings: Settings):
    staff = admin(client, settings)

    response = client.patch(f"{ADMIN_HAMPERS}/999/status", json={"status": "ACCEPTED"}, headers=staff["headers"])

    assert response.status_code == 404


def test_accepting_a_hamper_puts_it_in_the_orders_list_as_a_placed_order(client: TestClient, settings: Settings):
    hamper_id, _, _ = request_hamper(client, settings)
    staff = admin(client, settings)

    accepted = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=staff["headers"])
    orders = client.get(ADMIN_ORDERS, headers=staff["headers"]).json()["data"]["orders"]

    assert accepted.json()["data"]["hamper"]["orderId"] == orders[0]["id"]
    assert orders[0]["status"] == "PLACED"
    assert orders[0]["paymentMethod"] == "COD"
    assert orders[0]["paymentStatus"] == "PENDING"


def test_accepting_a_hamper_reserves_its_items_from_stock(client: TestClient, settings: Settings):
    hamper_id, product_id, _ = request_hamper(client, settings, stock=10)
    staff = admin(client, settings)

    client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=staff["headers"])

    assert stock_of(client, product_id) == 9


def test_accepting_a_hamper_is_refused_when_stock_has_run_out(client: TestClient, settings: Settings):
    hamper_id, product_id, _ = request_hamper(client, settings)
    staff = admin(client, settings)
    client.patch(f"/api/admin/products/{product_id}/stock", json={"stock": 0}, headers=staff["headers"])

    response = client.patch(f"{ADMIN_HAMPERS}/{hamper_id}/status", json={"status": "ACCEPTED"}, headers=staff["headers"])

    assert response.status_code == 422
    assert "Only 0 left" in response.json()["message"]
    orders = client.get(ADMIN_ORDERS, headers=staff["headers"]).json()["data"]["orders"]
    assert orders == []
