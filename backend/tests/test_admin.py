from fastapi.testclient import TestClient

from app.config.settings import Settings
from app.models.commerce import Order
from app.models.product import Product
from tests.factories import add_address, add_product, admin, shopper, stock_of

ADMIN = "/api/admin"
CART = "/api/cart"


def place_order(client: TestClient, buyer: dict, product_id: int, quantity: int = 2, method: str = "COD") -> int:
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": quantity}, headers=buyer["headers"])
    address_id = add_address(client, buyer["headers"])
    response = client.post("/api/orders", json={"addressId": address_id, "paymentMethod": method}, headers=buyer["headers"])
    assert response.status_code == 201, response.text
    return response.json()["data"]["order"]["id"]


def set_status(client: TestClient, order_id: int, status: str) -> None:
    session = client.app.state.session_factory()
    session.get(Order, order_id).status = status
    session.commit()
    session.close()


def test_admin_routes_require_sign_in(client: TestClient):
    assert client.get(f"{ADMIN}/dashboard").status_code == 401


def test_admin_routes_refuse_customers(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    assert client.get(f"{ADMIN}/dashboard", headers=buyer["headers"]).status_code == 403


def test_dashboard_reports_sales_orders_and_low_stock(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, price=100.0, stock=5)
    place_order(client, buyer, product_id, quantity=2)
    add_product(client, 2, price=10.0, stock=2)

    data = client.get(f"{ADMIN}/dashboard", headers=staff["headers"]).json()["data"]

    assert data["totalOrders"] == 1
    assert data["pendingOrders"] == 1
    assert data["revenue"] > 0
    assert data["totalCustomers"] == 1
    assert data["lowStockProducts"] == 2


def test_admin_creates_a_product_that_shoppers_can_see(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    body = {"name": "Rose Candle", "brand": "Bloom House", "price": 499, "stock": 12,
            "description": "Scented candle", "isActive": True}

    response = client.post(f"{ADMIN}/products", json=body, headers=staff["headers"])

    assert response.status_code == 201
    product_id = response.json()["data"]["product"]["id"]
    assert client.get(f"/api/products/{product_id}").status_code == 200


def test_admin_rejects_a_product_with_a_zero_price(client: TestClient, settings: Settings):
    staff = admin(client, settings)

    response = client.post(f"{ADMIN}/products", json={"name": "Free", "price": 0, "stock": 1}, headers=staff["headers"])

    assert response.status_code == 422


def test_admin_updates_stock_directly(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    product_id = add_product(client, 1, stock=3)

    response = client.patch(f"{ADMIN}/products/{product_id}/stock", json={"stock": 40}, headers=staff["headers"])

    assert response.status_code == 200
    assert stock_of(client, product_id) == 40


def test_deleting_a_product_hides_it_from_the_shop_but_keeps_it_for_history(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    product_id = add_product(client, 1, stock=3)

    response = client.delete(f"{ADMIN}/products/{product_id}", headers=staff["headers"])

    assert response.status_code == 200
    assert client.get(f"/api/products/{product_id}").status_code == 404
    session = client.app.state.session_factory()
    assert session.get(Product, product_id) is not None
    session.close()


def test_admin_moves_an_order_through_the_status_flow(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    order_id = place_order(client, buyer, add_product(client, 1, stock=9))

    response = client.patch(f"{ADMIN}/orders/{order_id}/status", json={"status": "CONFIRMED"}, headers=staff["headers"])

    assert response.status_code == 200
    order = client.get(f"/api/orders/{order_id}", headers=buyer["headers"]).json()["data"]["order"]
    assert [entry["status"] for entry in order["timeline"]] == ["PLACED", "CONFIRMED"]


def test_admin_cannot_skip_a_status(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    order_id = place_order(client, buyer, add_product(client, 1, stock=9))

    response = client.patch(f"{ADMIN}/orders/{order_id}/status", json={"status": "DELIVERED"}, headers=staff["headers"])

    assert response.status_code == 422


def test_admin_cancelling_an_order_restores_stock(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=9)
    order_id = place_order(client, buyer, product_id, quantity=2)

    client.patch(f"{ADMIN}/orders/{order_id}/status", json={"status": "CANCELLED"}, headers=staff["headers"])

    assert stock_of(client, product_id) == 9


def test_admin_lists_orders_filtered_by_status(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    first = place_order(client, buyer, add_product(client, 1, stock=9))
    place_order(client, buyer, add_product(client, 2, stock=9))
    set_status(client, first, "SHIPPED")

    orders = client.get(f"{ADMIN}/orders", params={"status": "SHIPPED"}, headers=staff["headers"]).json()["data"]["orders"]

    assert [o["id"] for o in orders] == [first]


def test_cash_on_delivery_can_be_marked_paid_only_after_delivery(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    order_id = place_order(client, buyer, add_product(client, 1, stock=9), method="COD")

    too_early = client.patch(f"{ADMIN}/orders/{order_id}/payment", json={"paid": True}, headers=staff["headers"])
    set_status(client, order_id, "DELIVERED")
    on_time = client.patch(f"{ADMIN}/orders/{order_id}/payment", json={"paid": True}, headers=staff["headers"])

    assert too_early.status_code == 422
    assert on_time.json()["data"]["order"]["paymentStatus"] == "PAID"


def test_admin_deactivates_a_customer_who_then_cannot_sign_in(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings, "blocked@example.com")

    response = client.patch(f"{ADMIN}/users/{buyer['id']}/active", json={"isActive": False}, headers=staff["headers"])

    assert response.status_code == 200
    assert client.get("/api/auth/me", headers=buyer["headers"]).status_code == 401


def test_admin_cannot_deactivate_their_own_account(client: TestClient, settings: Settings):
    staff = admin(client, settings)

    response = client.patch(f"{ADMIN}/users/{staff['id']}/active", json={"isActive": False}, headers=staff["headers"])

    assert response.status_code == 422


def test_admin_user_list_shows_order_counts(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings, "counted@example.com")
    place_order(client, buyer, add_product(client, 1, stock=9))

    users = client.get(f"{ADMIN}/users", headers=staff["headers"]).json()["data"]["users"]

    row = next(u for u in users if u["id"] == buyer["id"])
    assert row["orderCount"] == 1
    assert row["isActive"] is True
