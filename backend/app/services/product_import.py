import csv
import random
from collections.abc import Iterable, Iterator
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product

MAX_SEED_STOCK = 60
UNCATEGORIZED = "Uncategorized"


def assign_stock(source_id: int, seed: int) -> int:
    return random.Random(f"{seed}:{source_id}").randint(0, MAX_SEED_STOCK)


def top_level_category(path: str | None) -> str:
    if not path or not path.strip():
        return UNCATEGORIZED
    return path.split(">")[0].strip()


def first_image_url(raw: str | None) -> str | None:
    if not raw:
        return None
    first = raw.split("|")[0].strip()
    return first or None


def subcategory_of(path: str | None) -> str | None:
    if not path:
        return None
    parts = [part.strip() for part in path.split(">")]
    return parts[1] if len(parts) > 1 and parts[1] else None


def product_type_of(path: str | None) -> str | None:
    if not path:
        return None
    parts = [part.strip() for part in path.split(">")]
    return parts[2] if len(parts) > 2 and parts[2] else None


def _slugify(name: str) -> str:
    return "-".join(part for part in name.lower().replace("&", "and").split())


def read_products_csv(path: Path) -> Iterator[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        for position, row in enumerate(csv.DictReader(handle), start=1):
            yield {
                "source_id": position,
                "name": row["Name"].strip(),
                "brand": (row.get("Brand") or "").strip() or None,
                "category": top_level_category(row.get("Category")),
                "subcategory": subcategory_of(row.get("Category")),
                "product_type": product_type_of(row.get("Category")),
                "price": float(row["Price"]),
                "rating": float(row.get("Rating") or 0),
                "review_count": int(float(row.get("ReviewCount") or 0)),
                "image_url": first_image_url(row.get("ImgURL")),
                "description": (row.get("Desc") or "").strip() or None,
                "tags": (row.get("Tags") or "").strip(),
            }


def _category_for(session: Session, name: str, cache: dict[str, Category]) -> Category:
    if name not in cache:
        category = session.scalar(select(Category).where(Category.name == name))
        if category is None:
            category = Category(name=name, slug=_slugify(name))
            session.add(category)
            session.flush()
        cache[name] = category
    return cache[name]


def to_rupees(usd: float, rate: float) -> float:
    return round(usd * rate, 2)


def import_products(session: Session, rows: Iterable[dict], limit: int, seed: int, *, usd_to_inr: float) -> int:
    existing = set(session.scalars(select(Product.source_id)))
    categories: dict[str, Category] = {}
    inserted = 0

    for row in rows:
        if inserted >= limit:
            break
        if row["source_id"] in existing:
            continue
        category = _category_for(session, row["category"], categories)
        session.add(Product(
            source_id=row["source_id"],
            name=row["name"],
            brand=row["brand"],
            category_id=category.id,
            subcategory=row["subcategory"],
            product_type=row["product_type"],
            price=to_rupees(row["price"], usd_to_inr),
            rating=row["rating"],
            review_count=row["review_count"],
            image_url=row["image_url"],
            description=row["description"],
            tags=row["tags"],
            stock=assign_stock(row["source_id"], seed),
            is_active=True,
        ))
        existing.add(row["source_id"])
        inserted += 1

    session.commit()
    return inserted


OCCASIONS = (
    "Birthday", "Anniversary", "Karva Chauth", "Valentines Day", "Womens Day", "Daughters Day",
    "Mothers Day", "Fathers Day", "Rakhi", "Diwali", "Christmas", "Wedding", "Friendship Day",
)
RECIPIENTS = (
    "For Her", "For Him", "Daughter", "Girlfriend", "Wife", "Sister", "Brother", "Mother", "Father", "Husband",
    "Son", "Friend", "Kids",
)
ARCHIES_CATEGORY = "Archies Collection"


def _first_tag_in(tags: list[str], known: tuple[str, ...]) -> str | None:
    lowered = {tag.lower(): tag for tag in tags}
    for option in known:
        if option.lower() in lowered:
            return option
    return None


def _description(row: dict, tags: list[str]) -> str:
    exported = (row.get("description") or "").strip()
    if exported:
        return exported
    occasion = _first_tag_in(tags, OCCASIONS)
    recipient = _first_tag_in(tags, RECIPIENTS)
    parts = [row["title"].strip().rstrip(".") + "."]
    if occasion:
        parts.append(f"Occasion: {occasion}.")
    if recipient:
        parts.append(f"For: {recipient}.")
    return " ".join(parts)


def read_shopify_products(path: Path, vendor: str) -> Iterator[dict]:
    """Reads a Shopify product export. Rows without an image are skipped, and only the given vendor is kept."""
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if (row.get("vendor") or "").strip() != vendor:
                continue
            image_url = (row.get("image_url") or "").strip()
            if not image_url:
                continue
            tags = [tag.strip() for tag in (row.get("tags") or "").split("|") if tag.strip()]
            yield {
                "source_id": int(row["id"]),
                "name": row["title"].strip(),
                "brand": vendor,
                "category": ARCHIES_CATEGORY,
                "subcategory": _first_tag_in(tags, OCCASIONS) or "General",
                "product_type": _first_tag_in(tags, RECIPIENTS) or "Gifts",
                "price": float(row["price"]),
                "rating": 0.0,
                "review_count": 0,
                "image_url": image_url,
                "description": _description(row, tags),
                "tags": " ".join(tags),
            }
