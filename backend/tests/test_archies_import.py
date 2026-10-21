from pathlib import Path

from app.services.product_import import read_shopify_products

HEADER = "id,title,handle,description,price,compare_at_price,image_url,image_url_2,vendor,tags,available,type"


def write(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "shop.csv"
    path.write_text("\n".join([HEADER, *rows]) + "\n", encoding="utf-8")
    return path


def test_reads_a_shopify_row_into_our_product_shape(tmp_path: Path):
    path = write(tmp_path, [
        '15418938753173,Birthday Greeting Card,birthday-card,A card,299.00,,https://cdn.example/a.webp?v=1,https://cdn.example/b.webp,Archies,Birthday|Daughter|New,,',
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["source_id"] == 15418938753173
    assert row["name"] == "Birthday Greeting Card"
    assert row["price"] == 299.0
    assert row["image_url"] == "https://cdn.example/a.webp?v=1"
    assert row["category"] == "Archies Collection"
    assert row["subcategory"] == "Birthday"
    assert row["product_type"] == "Daughter"


def test_keeps_only_the_requested_vendor(tmp_path: Path):
    path = write(tmp_path, [
        "1,Ours,ours,,100.00,,https://cdn.example/1.webp,,Archies,Birthday,,",
        "2,Theirs,theirs,,100.00,,https://cdn.example/2.webp,,Surendra,Birthday,,",
    ])

    names = [row["name"] for row in read_shopify_products(path, vendor="Archies")]

    assert names == ["Ours"]


def test_falls_back_to_general_when_no_occasion_or_recipient_tag_matches(tmp_path: Path):
    path = write(tmp_path, [
        "3,Plain Card,plain,,150.00,,https://cdn.example/3.webp,,Archies,New|recently added,,",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["subcategory"] == "General"
    assert row["product_type"] == "Gifts"


def test_skips_rows_without_an_image(tmp_path: Path):
    path = write(tmp_path, [
        "4,No Picture,nopic,,150.00,,,,Archies,Birthday,,",
    ])

    assert list(read_shopify_products(path, vendor="Archies")) == []


def test_builds_a_factual_description_when_the_export_has_none(tmp_path: Path):
    path = write(tmp_path, [
        "5,Birthday Greeting Card,birthday-card,,299.00,,https://cdn.example/5.webp,,Archies,Birthday|Daughter|New,,",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["description"] == "Birthday Greeting Card. Occasion: Birthday. For: Daughter."


def test_keeps_the_export_description_when_one_is_present(tmp_path: Path):
    path = write(tmp_path, [
        "6,Card,card,Hand-lettered card,299.00,,https://cdn.example/6.webp,,Archies,Birthday,,",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["description"] == "Hand-lettered card"


NEW_HEADER = (
    "id,title,handle,description,price,compare_at_price,image_1,image_2,image_3,image_4,all_images,"
    "vendor,tags,available,product_type,category"
)


def write_new_format(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "shop_new.csv"
    path.write_text("\n".join([NEW_HEADER, *rows]) + "\n", encoding="utf-8")
    return path


def test_files_flower_rows_from_any_vendor_under_flowers(tmp_path: Path):
    path = write_new_format(tmp_path, [
        "7,Red Roses,roses,,1189.00,,https://cdn.example/7.webp,,,,,Surendra,Birthday|Flowers,,,flowers",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["category"] == "Flowers"
    assert row["brand"] == "Surendra"
    assert row["image_url"] == "https://cdn.example/7.webp"
    assert row["subcategory"] == "Birthday"


def test_files_chocolate_rows_from_any_vendor_under_chocolates(tmp_path: Path):
    path = write_new_format(tmp_path, [
        "8,Choco Box,choco,,499.00,,https://cdn.example/8.webp,,,,,MFT,Birthday,,,chocolates",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["category"] == "Chocolates"
    assert row["brand"] == "MFT"


def test_files_combo_rows_under_flowers_and_chocolates(tmp_path: Path):
    path = write_new_format(tmp_path, [
        "9,Rose Combo,combo,,899.00,,https://cdn.example/9.webp,,,,,Surendra,Birthday,,,flowers+chocolates",
    ])

    [row] = list(read_shopify_products(path, vendor="Archies"))

    assert row["category"] == "Flowers & Chocolates"


def test_keeps_general_rows_only_for_the_requested_vendor_in_the_new_format(tmp_path: Path):
    path = write_new_format(tmp_path, [
        "10,Ours,ours,,100.00,,https://cdn.example/10.webp,,,,,Archies,Birthday,,,general",
        "11,Theirs,theirs,,100.00,,https://cdn.example/11.webp,,,,,Surendra,Birthday,,,general",
    ])

    rows = list(read_shopify_products(path, vendor="Archies"))

    assert [(row["name"], row["category"], row["brand"]) for row in rows] == [("Ours", "Archies Collection", "Archies")]
