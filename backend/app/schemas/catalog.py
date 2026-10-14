from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

SortOption = Literal["relevance", "price-asc", "price-desc", "newest", "rating"]
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 24


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ProductOut(CamelModel):
    id: int
    name: str
    brand: str | None
    category_id: int | None
    price: float
    rating: float
    review_count: int
    image_url: str | None
    description: str | None
    stock: int


class ProductTypeOut(CamelModel):
    name: str
    product_count: int


class SubcategoryOut(CamelModel):
    name: str
    product_count: int
    types: list[ProductTypeOut] = []


class CategoryOut(CamelModel):
    id: int
    name: str
    slug: str
    product_count: int
    subcategories: list[SubcategoryOut] = []


class ProductQuery(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    category_id: int | None = None
    subcategory: str | None = Field(default=None, max_length=120)
    product_type: str | None = Field(default=None, max_length=120)
    min_rating: float | None = Field(default=None, ge=0, le=5)
    brand: str | None = Field(default=None, max_length=120)
    min_price: float | None = Field(default=None, ge=0)
    max_price: float | None = Field(default=None, ge=0)
    in_stock: bool = False
    sort: SortOption = "relevance"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
