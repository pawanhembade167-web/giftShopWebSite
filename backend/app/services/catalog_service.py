import math
from dataclasses import dataclass

from app.models.category import Category
from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.schemas.catalog import ProductQuery
from app.utils.errors import AppError

PRODUCT_NOT_FOUND_MESSAGE = "This product is no longer available."


@dataclass(frozen=True)
class ProductPage:
    items: list[Product]
    total: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        return max(1, math.ceil(self.total / self.page_size))


class CatalogService:
    def __init__(self, repository: ProductRepository):
        self._repository = repository

    def list_products(self, query: ProductQuery) -> ProductPage:
        items, total = self._repository.search(query)
        return ProductPage(items=items, total=total, page=query.page, page_size=query.page_size)

    def get_product(self, product_id: int) -> Product:
        product = self._repository.get_active(product_id)
        if product is None:
            raise AppError(404, PRODUCT_NOT_FOUND_MESSAGE)
        return product

    def list_brands(self, limit: int) -> list[tuple[str, int]]:
        return self._repository.brands(limit)

    def list_categories(self) -> list[dict]:
        return self._repository.category_summaries()
