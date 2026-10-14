from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.commerce import OrderStatus


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ProductAdminIn(CamelModel):
    name: str = Field(min_length=2, max_length=255)
    brand: str | None = Field(default=None, max_length=120)
    category_id: int | None = None
    subcategory: str | None = Field(default=None, max_length=120)
    product_type: str | None = Field(default=None, max_length=120)
    price: float = Field(gt=0, le=1_000_000)
    rating: float = Field(default=0.0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)
    image_url: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=2000)
    tags: str = Field(default="", max_length=500)
    stock: int = Field(ge=0, le=100_000)
    is_active: bool = True


class StockIn(CamelModel):
    stock: int = Field(ge=0, le=100_000)


class OrderStatusIn(CamelModel):
    status: Literal[
        "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"
    ]


class PaymentIn(CamelModel):
    paid: Literal[True]


class ActiveIn(CamelModel):
    is_active: bool


ORDER_STATUSES = [status.value for status in OrderStatus]
