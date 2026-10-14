from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.models.event import UserEvent
from tests.factories import add_product, shopper

CART = "/api/cart"


def test_cart_requires_sign_in(client: TestClient):
    assert client.get(CART).status_code == 401


def test_add_item_returns_cart_with_line_total(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=250.0, stock=5)

    response = client.post(f"{CART}/items", json={"productId": product_id, "quantity": 2}, headers=buyer["headers"])

    cart = response.json()["data"]["cart"]
    assert response.status_code == 200
    assert cart["items"][0]["quantity"] == 2
    assert cart["items"][0]["lineTotal"] == 500.0
    assert cart["subtotal"] == 500.0


def test_adding_the_same_product_again_increases_quantity(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=10)
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    cart = client.post(f"{CART}/items", json={"productId": product_id, "quantity": 2}, headers=buyer["headers"]).json()["data"]["cart"]

    assert cart["items"][0]["quantity"] == 3


def test_adding_more_than_stock_returns_422_with_remaining_count(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=2)

    response = client.post(f"{CART}/items", json={"productId": product_id, "quantity": 3}, headers=buyer["headers"])

    assert response.status_code == 422
    assert "Only 2 left" in response.json()["message"]


def test_adding_out_of_stock_product_returns_422(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=0)

    response = client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    assert response.status_code == 422


def test_adding_unknown_product_returns_404(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    response = client.post(f"{CART}/items", json={"productId": 999, "quantity": 1}, headers=buyer["headers"])

    assert response.status_code == 404


def test_update_quantity_changes_the_line(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=10.0, stock=9)
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    cart = client.patch(f"{CART}/items/{product_id}", json={"quantity": 4}, headers=buyer["headers"]).json()["data"]["cart"]

    assert cart["items"][0]["quantity"] == 4
    assert cart["subtotal"] == 40.0


def test_remove_item_empties_that_line(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=5)
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    cart = client.delete(f"{CART}/items/{product_id}", headers=buyer["headers"]).json()["data"]["cart"]

    assert cart["items"] == []
    assert cart["subtotal"] == 0.0


def test_adding_to_cart_records_an_add_to_cart_event(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=5)

    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    session = client.app.state.session_factory()
    events = session.query(UserEvent).filter_by(event_type="ADD_TO_CART", product_id=product_id, user_id=buyer["id"]).count()
    session.close()
    assert events == 1


def test_merge_guest_cart_adds_available_items_and_reports_the_rest(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    in_stock = add_product(client, 1, stock=5)
    sold_out = add_product(client, 2, stock=0)

    response = client.post(f"{CART}/merge", json={"items": [
        {"productId": in_stock, "quantity": 2},
        {"productId": sold_out, "quantity": 1},
    ]}, headers=buyer["headers"])

    data = response.json()["data"]
    assert data["cart"]["items"][0]["productId"] == in_stock
    assert data["skipped"] == [{"productId": sold_out, "reason": "out-of-stock"}]


def test_merge_keeps_existing_cart_quantities(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=10)
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])

    cart = client.post(f"{CART}/merge", json={"items": [{"productId": product_id, "quantity": 2}]},
                       headers=buyer["headers"]).json()["data"]["cart"]

    assert cart["items"][0]["quantity"] == 3


def test_cart_shows_shipping_tax_and_total_from_the_server(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=100.0, stock=5)

    cart = client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"]).json()["data"]["cart"]

    assert cart["shipping"] == 49.0
    assert cart["tax"] == 5.0
    assert cart["total"] == 154.0
