from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.models.event import UserEvent
from app.models.commerce import Order, OrderStatus
from tests.factories import add_address, add_product, shopper, stock_of

ORDERS = "/api/orders"
CART = "/api/cart"


def fill_cart(client: TestClient, headers: dict, product_id: int, quantity: int) -> None:
    response = client.post(f"{CART}/items", json={"productId": product_id, "quantity": quantity}, headers=headers)
    assert response.status_code == 200, response.text


def place(client: TestClient, headers: dict, address_id: int, method: str = "COD"):
    return client.post(ORDERS, json={"addressId": address_id, "paymentMethod": method}, headers=headers)


def test_placing_an_order_creates_it_clears_the_cart_and_reduces_stock(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=200.0, stock=5)
    fill_cart(client, buyer["headers"], product_id, 2)
    address_id = add_address(client, buyer["headers"])

    response = place(client, buyer["headers"], address_id)

    order = response.json()["data"]["order"]
    assert response.status_code == 201
    assert order["status"] == "PLACED"
    assert order["items"][0]["quantity"] == 2
    assert stock_of(client, product_id) == 3
    assert client.get(CART, headers=buyer["headers"]).json()["data"]["cart"]["items"] == []


def test_order_totals_add_shipping_below_the_free_threshold_and_tax(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=100.0, stock=5)
    fill_cart(client, buyer["headers"], product_id, 1)

    order = place(client, buyer["headers"], add_address(client, buyer["headers"])).json()["data"]["order"]

    assert order["subtotal"] == 100.0
    assert order["shipping"] == 49.0
    assert order["tax"] == 5.0
    assert order["total"] == 154.0


def test_order_has_no_shipping_fee_at_or_above_the_free_threshold(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=500.0, stock=5)
    fill_cart(client, buyer["headers"], product_id, 1)

    order = place(client, buyer["headers"], add_address(client, buyer["headers"])).json()["data"]["order"]

    assert order["shipping"] == 0.0


def test_placing_an_order_with_an_empty_cart_returns_422(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    response = place(client, buyer["headers"], add_address(client, buyer["headers"]))

    assert response.status_code == 422
    assert response.json()["message"] == "Your cart is empty."


def test_placing_an_order_with_another_shoppers_address_returns_404(client: TestClient, settings: Settings):
    owner = shopper(client, settings, "owner@example.com")
    buyer = shopper(client, settings, "buyer@example.com")
    address_id = add_address(client, owner["headers"])
    fill_cart(client, buyer["headers"], add_product(client, 1, stock=5), 1)

    assert place(client, buyer["headers"], address_id).status_code == 404


def test_placing_an_order_when_stock_has_dropped_returns_409(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=3)
    fill_cart(client, buyer["headers"], product_id, 3)
    session = client.app.state.session_factory()
    from app.models.product import Product
    session.get(Product, product_id).stock = 1
    session.commit()
    session.close()

    response = place(client, buyer["headers"], add_address(client, buyer["headers"]))

    assert response.status_code == 409
    assert stock_of(client, product_id) == 1


def test_unknown_payment_method_returns_422(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    fill_cart(client, buyer["headers"], add_product(client, 1, stock=5), 1)

    response = place(client, buyer["headers"], add_address(client, buyer["headers"]), method="BITCOIN")

    assert response.status_code == 422


def test_cash_on_delivery_order_is_payment_pending_and_mock_card_is_paid(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=9)
    address_id = add_address(client, buyer["headers"])
    fill_cart(client, buyer["headers"], product_id, 1)
    cod = place(client, buyer["headers"], address_id, "COD").json()["data"]["order"]
    fill_cart(client, buyer["headers"], product_id, 1)
    card = place(client, buyer["headers"], address_id, "MOCK_CARD").json()["data"]["order"]

    assert cod["paymentStatus"] == "PENDING"
    assert card["paymentStatus"] == "PAID"


def test_placing_an_order_records_purchase_events_for_each_product(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=5)
    fill_cart(client, buyer["headers"], product_id, 1)

    place(client, buyer["headers"], add_address(client, buyer["headers"]))

    session = client.app.state.session_factory()
    purchases = session.query(UserEvent).filter_by(event_type="PURCHASE", product_id=product_id, user_id=buyer["id"]).count()
    session.close()
    assert purchases == 1


def test_orders_list_and_detail_are_scoped_to_the_shopper(client: TestClient, settings: Settings):
    owner = shopper(client, settings, "owner@example.com")
    other = shopper(client, settings, "other@example.com")
    fill_cart(client, owner["headers"], add_product(client, 1, stock=5), 1)
    order_id = place(client, owner["headers"], add_address(client, owner["headers"])).json()["data"]["order"]["id"]

    assert len(client.get(ORDERS, headers=owner["headers"]).json()["data"]["orders"]) == 1
    assert client.get(ORDERS, headers=other["headers"]).json()["data"]["orders"] == []
    assert client.get(f"{ORDERS}/{order_id}", headers=other["headers"]).status_code == 404


def test_cancelling_a_placed_order_restores_stock(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=5)
    fill_cart(client, buyer["headers"], product_id, 2)
    order_id = place(client, buyer["headers"], add_address(client, buyer["headers"])).json()["data"]["order"]["id"]

    response = client.post(f"{ORDERS}/{order_id}/cancel", headers=buyer["headers"])

    assert response.json()["data"]["order"]["status"] == "CANCELLED"
    assert stock_of(client, product_id) == 5


def test_cancelling_a_shipped_order_returns_422(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    fill_cart(client, buyer["headers"], add_product(client, 1, stock=5), 1)
    order_id = place(client, buyer["headers"], add_address(client, buyer["headers"])).json()["data"]["order"]["id"]
    session = client.app.state.session_factory()
    session.get(Order, order_id).status = OrderStatus.SHIPPED.value
    session.commit()
    session.close()

    response = client.post(f"{ORDERS}/{order_id}/cancel", headers=buyer["headers"])

    assert response.status_code == 422


def test_order_detail_includes_a_status_timeline(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    fill_cart(client, buyer["headers"], add_product(client, 1, stock=5), 1)
    order_id = place(client, buyer["headers"], add_address(client, buyer["headers"])).json()["data"]["order"]["id"]

    timeline = client.get(f"{ORDERS}/{order_id}", headers=buyer["headers"]).json()["data"]["order"]["timeline"]

    assert [entry["status"] for entry in timeline] == ["PLACED"]
