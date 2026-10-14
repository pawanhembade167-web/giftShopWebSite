from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config.settings import Settings
from app.models.commerce import Order, Payment
from app.services.payments import PAYMENT_CANCELLED, PAYMENT_PAID, PAYMENT_REFUNDED, refund_if_paid
from tests.factories import add_address, add_product, admin, shopper

CART = "/api/cart"


def place(client: TestClient, buyer: dict, method: str) -> int:
    product_id = add_product(client, 1 if method == "COD" else 2, price=100.0, stock=9)
    client.post(f"{CART}/items", json={"productId": product_id, "quantity": 1}, headers=buyer["headers"])
    address_id = add_address(client, buyer["headers"])
    response = client.post("/api/orders", json={"addressId": address_id, "paymentMethod": method}, headers=buyer["headers"])
    assert response.status_code == 201, response.text
    return response.json()["data"]["order"]["id"]


def payments_for(client: TestClient, order_id: int) -> list[Payment]:
    session = client.app.state.session_factory()
    rows = list(session.scalars(select(Payment).where(Payment.order_id == order_id)))
    session.close()
    return rows


def test_placing_a_card_order_records_a_paid_payment_for_the_total(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    order_id = place(client, buyer, "MOCK_CARD")

    [payment] = payments_for(client, order_id)
    assert payment.status == PAYMENT_PAID
    assert payment.amount == 154.0
    assert payment.provider_reference is not None


def test_cancelling_a_paid_card_order_refunds_it(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    order_id = place(client, buyer, "MOCK_CARD")

    response = client.post(f"/api/orders/{order_id}/cancel", headers=buyer["headers"])

    assert response.json()["data"]["order"]["paymentStatus"] == PAYMENT_REFUNDED
    assert payments_for(client, order_id)[0].status == PAYMENT_REFUNDED


def test_cancelling_an_unpaid_cash_order_marks_the_payment_cancelled_not_refunded(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    order_id = place(client, buyer, "COD")

    client.post(f"/api/orders/{order_id}/cancel", headers=buyer["headers"])

    assert payments_for(client, order_id)[0].status == PAYMENT_CANCELLED


def test_admin_returning_a_paid_order_refunds_it(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    order_id = place(client, buyer, "MOCK_CARD")
    session = client.app.state.session_factory()
    session.get(Order, order_id).status = "DELIVERED"
    session.commit()
    session.close()

    response = client.patch(f"/api/admin/orders/{order_id}/status", json={"status": "RETURNED"}, headers=staff["headers"])

    assert response.status_code == 200
    assert payments_for(client, order_id)[0].status == PAYMENT_REFUNDED


def test_admin_marking_cash_paid_updates_the_payment_record(client: TestClient, settings: Settings):
    staff = admin(client, settings)
    buyer = shopper(client, settings)
    order_id = place(client, buyer, "COD")
    session = client.app.state.session_factory()
    session.get(Order, order_id).status = "DELIVERED"
    session.commit()
    session.close()

    client.patch(f"/api/admin/orders/{order_id}/payment", json={"paid": True}, headers=staff["headers"])

    assert payments_for(client, order_id)[0].status == PAYMENT_PAID


def test_a_payment_is_refunded_at_most_once(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    order_id = place(client, buyer, "MOCK_CARD")
    session = client.app.state.session_factory()
    order = session.get(Order, order_id)

    refund_if_paid(session, order)
    refund_if_paid(session, order)
    session.commit()

    refunds = [p for p in session.scalars(select(Payment).where(Payment.order_id == order_id)) if p.status == PAYMENT_REFUNDED]
    session.close()
    assert len(refunds) == 1
