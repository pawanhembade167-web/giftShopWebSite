from fastapi.testclient import TestClient

from app.models.category import Category
from app.models.product import Product

SUGGEST_PATH = "/api/search/suggestions"
PRODUCTS_PATH = "/api/products"


def seed(client: TestClient) -> None:
    session = client.app.state.session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    session.add(beauty)
    session.flush()
    session.add_all([
        Product(source_id=50, name="Gel Polish Bubble Bath", brand="OPI", category_id=beauty.id, price=5.0,
                rating=4.0, review_count=1, tags="nail", description="", stock=1, is_active=True,
                subcategory="Nail Polish", product_type="Gel Polish"),
        Product(source_id=51, name="Lotion", brand="Olay", category_id=beauty.id, price=7.0,
                rating=4.0, review_count=1, tags="skin", description="", stock=1, is_active=True,
                subcategory="Skin Care", product_type="Lotion"),
    ])
    session.commit()
    session.close()


def test_suggestions_for_a_partial_word_return_matching_products(client: TestClient):
    seed(client)

    products = client.get(SUGGEST_PATH, params={"q": "gel"}).json()["data"]["products"]

    assert [p["name"] for p in products] == ["Gel Polish Bubble Bath"]


def test_suggestions_return_matching_categories_and_subcategories(client: TestClient):
    seed(client)

    data = client.get(SUGGEST_PATH, params={"q": "nail"}).json()["data"]

    assert [s["name"] for s in data["subcategories"]] == ["Nail Polish"]
    assert data["subcategories"][0]["categoryId"] is not None
    assert data["categories"] == []


def test_suggestions_for_an_empty_term_are_empty(client: TestClient):
    seed(client)

    data = client.get(SUGGEST_PATH, params={"q": "  "}).json()["data"]

    assert data == {"products": [], "categories": [], "subcategories": []}


def test_suggestions_do_not_match_words_in_the_middle_of_a_name(client: TestClient):
    seed(client)

    products = client.get(SUGGEST_PATH, params={"q": "polish"}).json()["data"]["products"]

    assert [p["name"] for p in products] == ["Gel Polish Bubble Bath"]
    assert client.get(SUGGEST_PATH, params={"q": "ell"}).json()["data"]["products"] == []


def test_product_search_matches_subcategory_and_product_type(client: TestClient):
    seed(client)

    by_type = client.get(PRODUCTS_PATH, params={"q": "Gel Polish"}).json()["data"]["items"]
    by_subcategory = client.get(PRODUCTS_PATH, params={"q": "skin care"}).json()["data"]["items"]

    assert [i["name"] for i in by_type] == ["Gel Polish Bubble Bath"]
    assert [i["name"] for i in by_subcategory] == ["Lotion"]
