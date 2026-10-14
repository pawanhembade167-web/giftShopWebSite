from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrderStatus(str, Enum):
    PLACED = "PLACED"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    RETURNED = "RETURNED"


CANCELLABLE_STATUSES = frozenset({OrderStatus.PLACED.value, OrderStatus.CONFIRMED.value})


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)


class WishlistItem(Base):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_wishlist_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(20))
    line1: Mapped[str] = mapped_column(String(200))
    line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    postal_code: Mapped[str] = mapped_column(String(12))
    country: Mapped[str] = mapped_column(String(2), default="IN")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default=OrderStatus.PLACED.value)
    payment_method: Mapped[str] = mapped_column(String(20))
    payment_status: Mapped[str] = mapped_column(String(20))
    subtotal: Mapped[float] = mapped_column(Float)
    shipping: Mapped[float] = mapped_column(Float)
    tax: Mapped[float] = mapped_column(Float)
    total: Mapped[float] = mapped_column(Float)
    ship_full_name: Mapped[str] = mapped_column(String(100))
    ship_phone: Mapped[str] = mapped_column(String(20))
    ship_line1: Mapped[str] = mapped_column(String(200))
    ship_line2: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ship_city: Mapped[str] = mapped_column(String(100))
    ship_state: Mapped[str] = mapped_column(String(100))
    ship_postal_code: Mapped[str] = mapped_column(String(12))
    ship_country: Mapped[str] = mapped_column(String(2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    unit_price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[int] = mapped_column(Integer)


class OrderStatusEntry(Base):
    __tablename__ = "order_status_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    method: Mapped[str] = mapped_column(String(20))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20))
    provider_reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CustomHamper(Base):
    __tablename__ = "custom_hampers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    occasion: Mapped[str | None] = mapped_column(String(60), nullable=True)
    recipient_name: Mapped[str] = mapped_column(String(100))
    message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gift_wrap: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_total: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="REQUESTED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class HamperItem(Base):
    __tablename__ = "hamper_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    hamper_id: Mapped[int] = mapped_column(ForeignKey("custom_hampers.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(255))
    unit_price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[int] = mapped_column(Integer)
