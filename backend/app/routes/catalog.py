from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.repositories.product_repository import ProductRepository
from app.routes.auth import get_db_session
from app.schemas.catalog import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, CategoryOut, ProductOut, ProductQuery, SortOption
from app.services.catalog_service import CatalogService

BRAND_LIMIT_DEFAULT = 50
router = APIRouter(prefix="/api", tags=["catalog"])


def get_catalog_service(session: Session = Depends(get_db_session)) -> CatalogService:
    return CatalogService(ProductRepository(session))


def _envelope(data: dict, message: str) -> dict:
    return {"success": True, "data": data, "message": message}


@router.get("/products")
def list_products(
    q: str | None = Query(default=None, max_length=120),
    categoryId: int | None = None,
    subcategory: str | None = Query(default=None, max_length=120),
    productType: str | None = Query(default=None, max_length=120),
    minRating: float | None = Query(default=None, ge=0, le=5),
    brand: str | None = Query(default=None, max_length=120),
    minPrice: float | None = Query(default=None, ge=0),
    maxPrice: float | None = Query(default=None, ge=0),
    inStock: bool = False,
    sort: SortOption = "relevance",
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    query = ProductQuery(
        q=q, category_id=categoryId, subcategory=subcategory, product_type=productType, min_rating=minRating, brand=brand, min_price=minPrice, max_price=maxPrice,
        in_stock=inStock, sort=sort, page=page, page_size=pageSize,
    )
    result = service.list_products(query)
    return _envelope(
        {
            "items": [ProductOut.model_validate(p).model_dump(by_alias=True) for p in result.items],
            "page": result.page,
            "pageSize": result.page_size,
            "total": result.total,
            "totalPages": result.total_pages,
        },
        "Products fetched successfully.",
    )


@router.get("/products/{product_id}")
def get_product(product_id: int, service: CatalogService = Depends(get_catalog_service)) -> dict:
    product = service.get_product(product_id)
    return _envelope({"product": ProductOut.model_validate(product).model_dump(by_alias=True)}, "Product fetched successfully.")


@router.get("/categories")
def list_categories(service: CatalogService = Depends(get_catalog_service)) -> dict:
    categories = [CategoryOut.model_validate(c).model_dump(by_alias=True) for c in service.list_categories()]
    return _envelope({"categories": categories}, "Categories fetched successfully.")


@router.get("/brands")
def list_brands(
    limit: int = Query(default=BRAND_LIMIT_DEFAULT, ge=1, le=200),
    service: CatalogService = Depends(get_catalog_service),
) -> dict:
    brands = [{"name": name, "productCount": count} for name, count in service.list_brands(limit)]
    return _envelope({"brands": brands}, "Brands fetched successfully.")
