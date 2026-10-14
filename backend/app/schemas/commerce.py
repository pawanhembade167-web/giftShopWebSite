import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.auth import PHONE_PATTERN, PHONE_SEPARATORS

MAX_LINE_QUANTITY = 20
POSTAL_CODE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 -]{2,10}[A-Za-z0-9]$")


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CartItemIn(CamelModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=MAX_LINE_QUANTITY)


class CartQuantityIn(CamelModel):
    quantity: int = Field(ge=1, le=MAX_LINE_QUANTITY)


class MergeItemIn(CamelModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=MAX_LINE_QUANTITY)


class MergeIn(CamelModel):
    items: list[MergeItemIn] = Field(default_factory=list, max_length=50)


class WishlistItemIn(CamelModel):
    product_id: int


class AddressIn(CamelModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(max_length=20)
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(max_length=12)
    country: str = Field(default="IN", min_length=2, max_length=2)
    is_default: bool = False

    @field_validator("phone")
    @classmethod
    def normalise_phone(cls, value: str) -> str:
        cleaned = PHONE_SEPARATORS.sub("", value)
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError("Enter a valid phone number with 10 to 15 digits.")
        return cleaned

    @field_validator("postal_code")
    @classmethod
    def check_postal_code(cls, value: str) -> str:
        cleaned = value.strip()
        if not POSTAL_CODE_PATTERN.match(cleaned):
            raise ValueError("Enter a valid postal code.")
        return cleaned

    @field_validator("country")
    @classmethod
    def upper_country(cls, value: str) -> str:
        return value.upper()


class PlaceOrderIn(CamelModel):
    address_id: int
    payment_method: Literal["COD", "MOCK_CARD"]
