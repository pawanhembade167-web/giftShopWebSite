from pathlib import Path

from sqlalchemy import func, select

from app.config.database import create_session_factory
from app.models.product import Product
from app.services.product_import import MAX_SEED_STOCK, assign_stock, import_products, read_products_csv

CSV_HEADER = "ID,PID,Rating,ReviewCount,Category,Brand,Name,Price,ImgURL,Desc,Tags"


def write_csv(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "products.csv"
    path.write_text("\n".join([CSV_HEADER, *rows]) + "\n", encoding="utf-8")
    return path


def test_read_products_csv_maps_top_level_category_and_numeric_ids(tmp_path: Path):
    path = write_csv(tmp_path, [
        '1705736792.0,2.0,4.5,12.0,Beauty > Nail Polish,OPI,"OPI Bubble Bath",8.95,https://img/1.jpg,Pink,nail',
    ])

    rows = list(read_products_csv(path))

    assert rows[0]["source_id"] == 1
    assert rows[0]["category"] == "Beauty"
    assert rows[0]["price"] == 8.95
    assert rows[0]["review_count"] == 12


def test_import_products_inserts_sample_and_creates_categories(tmp_path: Path, settings):
    path = write_csv(tmp_path, [
        "1.0,1.0,0.0,0.0,Beauty > Nail,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail",
        "2.0,2.0,0.0,0.0,Health > Vitamins,Nature Made,Multivitamin,15.5,https://img/2.jpg,,vitamin",
    ])
    session_factory = create_session_factory(settings.database_url)

    with session_factory() as session:
        inserted = import_products(session, read_products_csv(path), limit=2, seed=42, usd_to_inr=1.0)
        count = session.scalar(select(func.count()).select_from(Product))

    assert inserted == 2
    assert count == 2


def test_import_products_skips_rows_already_present(tmp_path: Path, settings):
    path = write_csv(tmp_path, ["1.0,1.0,0.0,0.0,Beauty,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail"])
    session_factory = create_session_factory(settings.database_url)

    with session_factory() as session:
        import_products(session, read_products_csv(path), limit=10, seed=42, usd_to_inr=1.0)
        second_run = import_products(session, read_products_csv(path), limit=10, seed=42, usd_to_inr=1.0)

    assert second_run == 0


def test_assign_stock_is_repeatable_for_the_same_source_and_seed():
    first = [assign_stock(source_id, seed=7) for source_id in range(1, 6)]
    second = [assign_stock(source_id, seed=7) for source_id in range(1, 6)]

    assert first == second
    assert all(0 <= stock <= MAX_SEED_STOCK for stock in first)


def test_read_products_csv_keeps_only_the_first_image_url(tmp_path: Path):
    path = write_csv(tmp_path, [
        "1.0,1.0,0.0,0.0,Beauty,OPI,Bubble Bath,8.95,https://img/a.jpg | https://img/b.jpg,,nail",
    ])

    rows = list(read_products_csv(path))

    assert rows[0]["image_url"] == "https://img/a.jpg"


def test_read_products_csv_keeps_the_second_level_as_subcategory(tmp_path: Path):
    path = write_csv(tmp_path, [
        '1.0,1.0,0.0,0.0,Beauty > Nail Polish > Gel,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail',
    ])

    rows = list(read_products_csv(path))

    assert rows[0]["subcategory"] == "Nail Polish"


def test_read_products_csv_has_no_subcategory_for_a_single_level_path(tmp_path: Path):
    path = write_csv(tmp_path, ["1.0,1.0,0.0,0.0,Beauty,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail"])

    rows = list(read_products_csv(path))

    assert rows[0]["subcategory"] is None


def test_read_products_csv_keeps_the_third_level_as_product_type(tmp_path: Path):
    path = write_csv(tmp_path, [
        '1.0,1.0,0.0,0.0,Beauty > Nail Polish > Gel Polish,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail',
    ])

    rows = list(read_products_csv(path))

    assert rows[0]["product_type"] == "Gel Polish"


def test_import_products_converts_usd_prices_to_rupees_with_the_configured_rate(tmp_path: Path, settings):
    path = write_csv(tmp_path, ["1.0,1.0,0.0,0.0,Beauty,OPI,Bubble Bath,8.95,https://img/1.jpg,,nail"])
    session_factory = create_session_factory(settings.database_url)

    with session_factory() as session:
        import_products(session, read_products_csv(path), limit=1, seed=42, usd_to_inr=83.0)
        stored = session.scalar(select(Product.price))

    assert stored == 742.85
