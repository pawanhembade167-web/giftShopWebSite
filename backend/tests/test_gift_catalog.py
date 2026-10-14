from pathlib import Path

from scripts.generate_gift_catalog import generate_catalog
from app.services.product_import import read_products_csv


def test_generated_gift_catalog_has_three_level_categories_and_rupee_prices(tmp_path: Path):
    path = tmp_path / "gifts.csv"
    generate_catalog(path, seed=7)

    rows = list(read_products_csv(path))

    assert len(rows) >= 120
    assert all(row["product_type"] for row in rows)
    assert all(row["subcategory"] for row in rows)
    assert all(10 <= row["price"] <= 15000 for row in rows)


def test_generated_gift_catalog_is_repeatable_for_the_same_seed(tmp_path: Path):
    first = tmp_path / "a.csv"
    second = tmp_path / "b.csv"
    generate_catalog(first, seed=7)
    generate_catalog(second, seed=7)

    assert first.read_text(encoding="utf-8") == second.read_text(encoding="utf-8")


def test_conversion_rate_is_one_when_prices_are_already_rupees():
    from scripts.import_products import conversion_rate

    assert conversion_rate("inr", usd_to_inr=83.0) == 1.0
    assert conversion_rate("usd", usd_to_inr=83.0) == 83.0


def test_every_generated_product_gets_a_placeholder_image_and_file(tmp_path: Path):
    csv_path = tmp_path / "gifts.csv"
    image_dir = tmp_path / "products"
    generate_catalog(csv_path, seed=7, image_dir=image_dir)

    rows = list(read_products_csv(csv_path))

    assert all(row["image_url"] == f"assets/products/{row['source_id']}.svg" for row in rows)
    assert all((image_dir / f"{row['source_id']}.svg").exists() for row in rows)
