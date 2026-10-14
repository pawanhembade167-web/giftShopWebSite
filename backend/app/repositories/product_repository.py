from sqlalchemy import Select, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product
from app.schemas.catalog import ProductQuery

SUGGESTION_LIMIT = 6


def _word_starts_with(column, term: str):
    lowered = func.lower(column)
    return or_(lowered.like(f"{term}%"), lowered.like(f"% {term}%"))

MAX_TYPES_PER_SUBCATEGORY = 12

SORT_CLAUSES = {
    "relevance": (Product.id.asc(),),
    "price-asc": (Product.price.asc(), Product.id.asc()),
    "price-desc": (Product.price.desc(), Product.id.asc()),
    "newest": (Product.id.desc(),),
    "rating": (Product.rating.desc(), Product.review_count.desc(), Product.id.asc()),
}


class ProductRepository:
    def __init__(self, session: Session):
        self._session = session

    def _filtered(self, query: ProductQuery) -> Select:
        statement = select(Product).where(Product.is_active.is_(True))
        if query.q:
            term = f"%{query.q.strip().lower()}%"
            statement = statement.where(or_(
                func.lower(Product.name).like(term),
                func.lower(Product.brand).like(term),
                func.lower(Product.subcategory).like(term),
                func.lower(Product.product_type).like(term),
                func.lower(Product.tags).like(term),
            ))
        if query.category_id is not None:
            statement = statement.where(Product.category_id == query.category_id)
        if query.subcategory:
            statement = statement.where(Product.subcategory == query.subcategory)
        if query.product_type:
            statement = statement.where(Product.product_type == query.product_type)
        if query.min_rating is not None:
            statement = statement.where(Product.rating >= query.min_rating)
        if query.brand:
            statement = statement.where(Product.brand == query.brand)
        if query.min_price is not None:
            statement = statement.where(Product.price >= query.min_price)
        if query.max_price is not None:
            statement = statement.where(Product.price <= query.max_price)
        if query.in_stock:
            statement = statement.where(Product.stock > 0)
        return statement

    def search(self, query: ProductQuery) -> tuple[list[Product], int]:
        filtered = self._filtered(query)
        total = self._session.scalar(select(func.count()).select_from(filtered.subquery())) or 0
        ordered = filtered.order_by(*SORT_CLAUSES[query.sort])
        offset = (query.page - 1) * query.page_size
        items = list(self._session.scalars(ordered.offset(offset).limit(query.page_size)))
        return items, total

    def all_active(self) -> list[Product]:
        return list(self._session.scalars(select(Product).where(Product.is_active.is_(True)).order_by(Product.id)))

    def get_active(self, product_id: int) -> Product | None:
        product = self._session.get(Product, product_id)
        return product if product and product.is_active else None

    def brands(self, limit: int) -> list[tuple[str, int]]:
        count = func.count(Product.id).label("product_count")
        statement = (
            select(Product.brand, count)
            .where(Product.is_active.is_(True), Product.brand.is_not(None))
            .group_by(Product.brand)
            .order_by(desc(count), Product.brand)
            .limit(limit)
        )
        return [(brand, total) for brand, total in self._session.execute(statement)]

    def suggest(self, term: str) -> dict:
        active = Product.is_active.is_(True)
        pattern = term.strip().lower()
        if not pattern:
            return {"products": [], "categories": [], "subcategories": []}
        products = list(self._session.scalars(
            select(Product)
            .where(active, or_(_word_starts_with(Product.name, pattern), _word_starts_with(Product.brand, pattern),
                               _word_starts_with(Product.product_type, pattern)))
            .order_by(Product.review_count.desc(), Product.id)
            .limit(SUGGESTION_LIMIT)
        ))
        categories = list(self._session.scalars(
            select(Category).where(_word_starts_with(Category.name, pattern)).order_by(Category.name).limit(SUGGESTION_LIMIT)
        ))
        subcategories = [
            {"name": name, "categoryId": category_id, "productCount": count}
            for name, category_id, count in self._session.execute(
                select(Product.subcategory, Product.category_id, func.count(Product.id))
                .where(active, Product.subcategory.is_not(None), _word_starts_with(Product.subcategory, pattern))
                .group_by(Product.subcategory, Product.category_id)
                .order_by(desc(func.count(Product.id)), Product.subcategory)
                .limit(SUGGESTION_LIMIT)
            )
        ]
        return {
            "products": products,
            "categories": categories,
            "subcategories": subcategories,
        }

    def categories(self) -> list[Category]:
        return list(self._session.scalars(select(Category).order_by(Category.name)))

    def category_summaries(self) -> list[dict]:
        active = Product.is_active.is_(True)
        totals = dict(self._session.execute(
            select(Product.category_id, func.count(Product.id)).where(active).group_by(Product.category_id)
        ).all())
        types: dict[tuple[int, str], list[dict]] = {}
        for category_id, subcategory, name, count in self._session.execute(
            select(Product.category_id, Product.subcategory, Product.product_type, func.count(Product.id))
            .where(active, Product.subcategory.is_not(None), Product.product_type.is_not(None))
            .group_by(Product.category_id, Product.subcategory, Product.product_type)
            .order_by(desc(func.count(Product.id)), Product.product_type)
        ):
            types.setdefault((category_id, subcategory), []).append({"name": name, "productCount": count})
        subs: dict[int, list[dict]] = {}
        for category_id, name, count in self._session.execute(
            select(Product.category_id, Product.subcategory, func.count(Product.id))
            .where(active, Product.subcategory.is_not(None))
            .group_by(Product.category_id, Product.subcategory)
            .order_by(desc(func.count(Product.id)), Product.subcategory)
        ):
            subs.setdefault(category_id, []).append({
                "name": name,
                "productCount": count,
                "types": types.get((category_id, name), [])[:MAX_TYPES_PER_SUBCATEGORY],
            })
        return [
            {
                "id": category.id,
                "name": category.name,
                "slug": category.slug,
                "productCount": totals.get(category.id, 0),
                "subcategories": subs.get(category.id, []),
            }
            for category in self.categories()
            if totals.get(category.id, 0) > 0
        ]
