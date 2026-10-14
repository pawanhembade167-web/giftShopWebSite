from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product

PRODUCTS_PATH = "/api/products"
CATEGORIES_PATH = "/api/categories"


def seed(client: TestClient) -> dict[str, Category]:
    session_factory = client.app.state.session_factory
    session: Session = session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    health = Category(name="Health", slug="health")
    session.add_all([beauty, health])
    session.flush()
    session.add_all([
        Product(source_id=1, name="OPI Nail Lacquer Bubble Bath", brand="OPI", category_id=beauty.id,
                price=8.95, rating=4.5, review_count=120, image_url="https://img/1.jpg", description="Pink polish",
                tags="nail polish", stock=10, is_active=True),
        Product(source_id=2, name="Vitamin C Serum", brand="Olay", category_id=beauty.id,
                price=24.0, rating=4.1, review_count=30, image_url="https://img/2.jpg", description="Serum",
                tags="serum skin", stock=0, is_active=True),
        Product(source_id=3, name="Multivitamin Tablets", brand="Nature Made", category_id=health.id,
                price=15.5, rating=0.0, review_count=0, image_url="https://img/3.jpg", description="Daily",
                tags="vitamin", stock=25, is_active=True),
        Product(source_id=4, name="Discontinued Lotion", brand="OPI", category_id=beauty.id,
                price=5.0, rating=3.0, review_count=2, image_url=None, description=None,
                tags="lotion", stock=5, is_active=False),
    ])
    session.commit()
    session.close()
    return {"beauty": beauty, "health": health}


def test_list_products_returns_only_active_products_with_paging_metadata(client: TestClient):
    seed(client)

    body = client.get(PRODUCTS_PATH, params={"pageSize": 2}).json()

    assert body["success"] is True
    assert body["data"]["total"] == 3
    assert body["data"]["totalPages"] == 2
    assert len(body["data"]["items"]) == 2


def test_list_products_search_matches_name_and_brand_case_insensitively(client: TestClient):
    seed(client)

    by_brand = client.get(PRODUCTS_PATH, params={"q": "NATURE"}).json()["data"]["items"]
    by_name = client.get(PRODUCTS_PATH, params={"q": "serum"}).json()["data"]["items"]

    assert [item["brand"] for item in by_brand] == ["Nature Made"]
    assert [item["name"] for item in by_name] == ["Vitamin C Serum"]


def test_list_products_filters_by_category_and_price_range(client: TestClient):
    categories = seed(client)

    response = client.get(PRODUCTS_PATH, params={"categoryId": categories["beauty"].id, "minPrice": 8, "maxPrice": 20})

    names = [item["name"] for item in response.json()["data"]["items"]]
    assert names == ["OPI Nail Lacquer Bubble Bath"]


def test_list_products_in_stock_only_excludes_zero_stock(client: TestClient):
    seed(client)

    items = client.get(PRODUCTS_PATH, params={"inStock": "true"}).json()["data"]["items"]

    assert "Vitamin C Serum" not in [item["name"] for item in items]


def test_list_products_sorted_by_price_ascending(client: TestClient):
    seed(client)

    items = client.get(PRODUCTS_PATH, params={"sort": "price-asc"}).json()["data"]["items"]

    assert [item["price"] for item in items] == sorted(item["price"] for item in items)


def test_list_products_rejects_unknown_sort_with_422(client: TestClient):
    response = client.get(PRODUCTS_PATH, params={"sort": "bogus"})

    assert response.status_code == 422


def test_get_product_returns_camel_case_fields_and_stock(client: TestClient):
    seed(client)

    product = client.get(f"{PRODUCTS_PATH}/1").json()["data"]["product"]

    assert product["name"] == "OPI Nail Lacquer Bubble Bath"
    assert product["stock"] == 10
    assert product["reviewCount"] == 120
    assert product["imageUrl"] == "https://img/1.jpg"


def test_get_product_unknown_id_returns_404(client: TestClient):
    response = client.get(f"{PRODUCTS_PATH}/999")

    assert response.status_code == 404
    assert response.json()["success"] is False


def test_get_product_inactive_returns_404(client: TestClient):
    seed(client)

    response = client.get(f"{PRODUCTS_PATH}/4")

    assert response.status_code == 404


def test_categories_lists_each_category_with_its_id(client: TestClient):
    categories = seed(client)

    body = client.get(CATEGORIES_PATH).json()["data"]["categories"]

    beauty = next(c for c in body if c["id"] == categories["beauty"].id)
    assert beauty["name"] == "Beauty"
    assert beauty["slug"] == "beauty"
    assert len(body) == 2


def test_brands_lists_most_common_brands_first(client: TestClient):
    seed(client)

    brands = client.get("/api/brands").json()["data"]["brands"]

    counts = [brand["productCount"] for brand in brands]
    assert counts == sorted(counts, reverse=True)
    assert {"name": "OPI", "productCount": 1} in brands
    assert {"name": "Olay", "productCount": 1} in brands


def test_categories_include_subcategories_with_product_counts(client: TestClient):
    session = client.app.state.session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    session.add(beauty)
    session.flush()
    session.add_all([
        Product(source_id=20, name="Nail A", brand="OPI", category_id=beauty.id, price=5.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True, subcategory="Nail Polish"),
        Product(source_id=21, name="Nail B", brand="OPI", category_id=beauty.id, price=6.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True, subcategory="Nail Polish"),
        Product(source_id=22, name="Lotion", brand="Olay", category_id=beauty.id, price=7.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True, subcategory="Skin Care"),
    ])
    session.commit()
    session.close()

    beauty_row = next(c for c in client.get(CATEGORIES_PATH).json()["data"]["categories"] if c["name"] == "Beauty")

    assert beauty_row["productCount"] == 3
    assert beauty_row["subcategories"] == [
        {"name": "Nail Polish", "productCount": 2, "types": []},
        {"name": "Skin Care", "productCount": 1, "types": []},
    ]


def test_list_products_filters_by_subcategory(client: TestClient):
    session = client.app.state.session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    session.add(beauty)
    session.flush()
    session.add_all([
        Product(source_id=30, name="Nail A", brand="OPI", category_id=beauty.id, price=5.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True, subcategory="Nail Polish"),
        Product(source_id=31, name="Lotion", brand="Olay", category_id=beauty.id, price=7.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True, subcategory="Skin Care"),
    ])
    session.commit()
    session.close()

    names = [i["name"] for i in client.get(PRODUCTS_PATH, params={"subcategory": "Nail Polish"}).json()["data"]["items"]]

    assert names == ["Nail A"]


def test_list_products_filters_by_minimum_rating(client: TestClient):
    seed(client)

    names = [i["name"] for i in client.get(PRODUCTS_PATH, params={"minRating": 4}).json()["data"]["items"]]

    assert "Vitamin C Serum" in names
    assert "Multivitamin Tablets" not in names


def test_list_products_filters_by_product_type(client: TestClient):
    session = client.app.state.session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    session.add(beauty)
    session.flush()
    session.add_all([
        Product(source_id=40, name="Gel Polish", brand="OPI", category_id=beauty.id, price=5.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True,
                subcategory="Nail Polish", product_type="Gel Polish"),
        Product(source_id=41, name="Regular Polish", brand="OPI", category_id=beauty.id, price=5.0, rating=4.0,
                review_count=1, tags="", description="", stock=1, is_active=True,
                subcategory="Nail Polish", product_type="Lacquer"),
    ])
    session.commit()
    session.close()

    names = [i["name"] for i in client.get(PRODUCTS_PATH, params={"productType": "Gel Polish"}).json()["data"]["items"]]

    assert names == ["Gel Polish"]


def test_categories_with_no_products_on_sale_are_not_listed(client: TestClient):
    session = client.app.state.session_factory()
    empty = Category(name="Hidden Only", slug="hidden-only")
    session.add(empty)
    session.flush()
    session.add(Product(source_id=70, name="Old Item", brand="X", category_id=empty.id, price=5.0, rating=4.0,
                        review_count=1, tags="", description="", stock=1, is_active=False))
    session.commit()
    session.close()

    names = [c["name"] for c in client.get(CATEGORIES_PATH).json()["data"]["categories"]]

    assert "Hidden Only" not in names
