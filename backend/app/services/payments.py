import uuid
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.commerce import Order, Payment
from app.utils.errors import AppError

PAYMENT_PENDING = "PENDING"
PAYMENT_PAID = "PAID"
PAYMENT_REFUNDED = "REFUNDED"
PAYMENT_CANCELLED = "CANCELLED"


class PaymentMethod(str, Enum):
    COD = "COD"
    MOCK_CARD = "MOCK_CARD"


@dataclass(frozen=True)
class PaymentResult:
    status: str
    provider_reference: str | None


class PaymentProvider(Protocol):
    def charge(self, amount: float) -> PaymentResult: ...

    def refund(self, provider_reference: str | None, amount: float) -> str: ...


class CashOnDeliveryProvider:
    def charge(self, amount: float) -> PaymentResult:
        return PaymentResult(PAYMENT_PENDING, None)

    def refund(self, provider_reference: str | None, amount: float) -> str:
        return PAYMENT_REFUNDED


class MockPaymentProvider:
    """Development card provider. A real gateway (for example Razorpay) implements the same two methods."""

    def charge(self, amount: float) -> PaymentResult:
        return PaymentResult(PAYMENT_PAID, f"mock_{uuid.uuid4().hex[:16]}")

    def refund(self, provider_reference: str | None, amount: float) -> str:
        return PAYMENT_REFUNDED


_PROVIDERS: dict[PaymentMethod, PaymentProvider] = {
    PaymentMethod.COD: CashOnDeliveryProvider(),
    PaymentMethod.MOCK_CARD: MockPaymentProvider(),
}


def provider_for(method: str) -> PaymentProvider:
    try:
        return _PROVIDERS[PaymentMethod(method)]
    except ValueError as error:
        raise AppError(422, "Choose a supported payment method.") from error


def record_charge(session: Session, order: Order, amount: float) -> Payment:
    provider = provider_for(order.payment_method)
    result = provider.charge(amount)
    payment = Payment(
        order_id=order.id,
        method=order.payment_method,
        amount=amount,
        status=result.status,
        provider_reference=result.provider_reference,
    )
    session.add(payment)
    order.payment_status = result.status
    return payment


def _payments(session: Session, order: Order, status: str) -> list[Payment]:
    return list(session.scalars(select(Payment).where(Payment.order_id == order.id, Payment.status == status)))


def mark_cash_paid(session: Session, order: Order) -> None:
    for payment in _payments(session, order, PAYMENT_PENDING):
        payment.status = PAYMENT_PAID
    order.payment_status = PAYMENT_PAID


def refund_if_paid(session: Session, order: Order) -> None:
    """Refunds every paid charge on the order. Charges already refunded are skipped, so this is safe to repeat."""
    for payment in _payments(session, order, PAYMENT_PAID):
        provider = provider_for(payment.method)
        payment.status = provider.refund(payment.provider_reference, payment.amount)
    if any(p.status == PAYMENT_REFUNDED for p in session.scalars(select(Payment).where(Payment.order_id == order.id))):
        order.payment_status = PAYMENT_REFUNDED


def cancel_unpaid(session: Session, order: Order) -> None:
    for payment in _payments(session, order, PAYMENT_PENDING):
        payment.status = PAYMENT_CANCELLED
    if order.payment_status == PAYMENT_PENDING:
        order.payment_status = PAYMENT_CANCELLED


def settle_on_end_of_order(session: Session, order: Order) -> None:
    """Called when an order is cancelled or returned: refund anything paid, close anything unpaid."""
    refund_if_paid(session, order)
    cancel_unpaid(session, order)
