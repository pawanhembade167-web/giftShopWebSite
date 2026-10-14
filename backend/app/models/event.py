from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class EventType(str, Enum):
    PRODUCT_VIEW = "PRODUCT_VIEW"
    PRODUCT_CLICK = "PRODUCT_CLICK"
    SEARCH = "SEARCH"
    CATEGORY_VIEW = "CATEGORY_VIEW"
    WISHLIST = "WISHLIST"
    ADD_TO_CART = "ADD_TO_CART"
    REMOVE_FROM_CART = "REMOVE_FROM_CART"
    PURCHASE = "PURCHASE"


PRODUCT_EVENT_TYPES = frozenset({
    EventType.PRODUCT_VIEW,
    EventType.PRODUCT_CLICK,
    EventType.WISHLIST,
    EventType.ADD_TO_CART,
    EventType.REMOVE_FROM_CART,
    EventType.PURCHASE,
})


class UserEvent(Base):
    __tablename__ = "user_events"
    __table_args__ = (Index("ix_user_events_product_created", "product_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    anonymous_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(32))
    query: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
