from fastapi.testclient import TestClient

from app.auth.security import create_access_token
from app.models.category import Category
from app.models.event import EventType, UserEvent
from app.models.product import Product
from app.models.user import User

EVENTS_PATH = "/api/events"
HOME_PATH = "/api/recommendations/home"
PRODUCT_RECS_PATH = "/api/recommendations/product"
SIMILAR_PATH = "/api/recommendations/similar"
FREQUENTLY_BOUGHT_PATH = "/api/recommendations/frequently-bought"
USER_RECS_PATH = "/api/recommendations/user"


def seed_catalog(client: TestClient) -> None:
    session = client.app.state.session_factory()
    beauty = Category(name="Beauty", slug="beauty")
    health = Category(name="Health", slug="health")
    session.add_all([beauty, health])
    session.flush()
    session.add_all([
        Product(source_id=1, name="Nail Polish Pink", brand="OPI", category_id=beauty.id, price=8.0,
                rating=4.0, review_count=10, tags="nail polish pink", description="Pink nail polish",
                stock=5, is_active=True),
        Product(source_id=2, name="Nail Polish Red", brand="OPI", category_id=beauty.id, price=8.5,
                rating=4.0, review_count=10, tags="nail polish red", description="Red nail polish",
                stock=5, is_active=True),
        Product(source_id=3, name="Vitamin D Tablets", brand="NatureMade", category_id=health.id, price=12.0,
                rating=4.0, review_count=10, tags="vitamin supplement", description="Daily vitamin D",
                stock=5, is_active=True),
        Product(source_id=4, name="Vitamin C Gummies", brand="NatureMade", category_id=health.id, price=11.0,
                rating=4.0, review_count=10, tags="vitamin gummies", description="Chewable vitamin C",
                stock=5, is_active=True),
        Product(source_id=5, name="Argan Shampoo", brand="Pantene", category_id=beauty.id, price=9.0,
                rating=4.9, review_count=500, tags="shampoo hair argan", description="Shampoo",
                stock=5, is_active=True),
    ])
    session.commit()
    session.close()


def record(client: TestClient, event_type: str, product_id: int | None = None, anonymous_id: str | None = None,
           user_id: int | None = None) -> None:
    session = client.app.state.session_factory()
    session.add(UserEvent(event_type=event_type, product_id=product_id, anonymous_id=anonymous_id, user_id=user_id))
    session.commit()
    session.close()


def make_user(client: TestClient, email: str) -> int:
    session = client.app.state.session_factory()
    user = User(full_name="Test User", email=email, phone="9876543210", password_hash="x", role="CUSTOMER")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return user_id


def ids_of(response_body: dict) -> list[int]:
    return [item["productId"] for item in response_body["data"]["recommendations"]]


def test_post_event_anonymous_view_is_stored(client: TestClient):
    seed_catalog(client)
    response = client.post(EVENTS_PATH, json={"eventType": "PRODUCT_VIEW", "productId": 1, "anonymousId": "anon-visitor-1"})

    assert response.status_code == 201
    session = client.app.state.session_factory()
    assert session.query(UserEvent).count() == 1
    session.close()


def test_post_event_with_unknown_event_type_returns_422(client: TestClient):
    response = client.post(EVENTS_PATH, json={"eventType": "TELEPORT", "productId": 1, "anonymousId": "anon-visitor-1"})

    assert response.status_code == 422


def test_post_product_event_without_identity_returns_422(client: TestClient):
    seed_catalog(client)

    response = client.post(EVENTS_PATH, json={"eventType": "PRODUCT_VIEW", "productId": 1})

    assert response.status_code == 422


def test_post_event_for_unknown_product_returns_404(client: TestClient):
    response = client.post(EVENTS_PATH, json={"eventType": "PRODUCT_VIEW", "productId": 999, "anonymousId": "anon-visitor-1"})

    assert response.status_code == 404


def test_home_cold_start_ranks_the_highest_rated_popular_product_first(client: TestClient):
    seed_catalog(client)

    body = client.get(HOME_PATH).json()

    assert ids_of(body)[0] == 5
    assert body["data"]["strategy"] == "cold-start"
    assert {item["reason"] for item in body["data"]["recommendations"]} <= {
        "Top rated", "Trending right now", "Popular with shoppers"
    }


def test_home_scores_are_between_zero_and_one(client: TestClient):
    seed_catalog(client)

    scores = [item["score"] for item in client.get(HOME_PATH).json()["data"]["recommendations"]]

    assert scores and all(0.0 <= score <= 1.0 for score in scores)


def test_home_for_anonymous_viewer_recommends_similar_product_and_excludes_the_viewed_one(client: TestClient):
    seed_catalog(client)
    record(client, EventType.PRODUCT_VIEW.value, product_id=1, anonymous_id="anon-visitor-1")

    body = client.get(HOME_PATH, params={"anonymousId": "anon-visitor-1"}).json()

    assert ids_of(body)[0] == 2
    assert 1 not in ids_of(body)
    assert body["data"]["recommendations"][0]["reason"] == "Similar to what you viewed"
    assert body["data"]["strategy"] == "personalized"


def test_home_collaborative_signal_appears_once_enough_users_exist(client: TestClient, settings):
    seed_catalog(client)
    viewer = make_user(client, "viewer@example.com")
    record(client, "PRODUCT_VIEW", product_id=1, user_id=viewer)
    for index in range(3):
        peer = make_user(client, f"peer{index}@example.com")
        record(client, "PRODUCT_VIEW", product_id=1, user_id=peer)
        record(client, "PRODUCT_VIEW", product_id=3, user_id=peer)
    token = create_access_token(viewer, settings)

    body = client.get(USER_RECS_PATH, headers={"Authorization": f"Bearer {token}"}).json()

    reasons = {item["productId"]: item["reason"] for item in body["data"]["recommendations"]}
    assert reasons.get(3) == "Customers with similar taste liked this"


def test_home_collaborative_signal_is_off_below_the_minimum_user_count(client: TestClient, settings):
    seed_catalog(client)
    viewer = make_user(client, "viewer@example.com")
    record(client, "PRODUCT_VIEW", product_id=1, user_id=viewer)
    peer = make_user(client, "peer@example.com")
    record(client, "PRODUCT_VIEW", product_id=1, user_id=peer)
    record(client, "PRODUCT_VIEW", product_id=3, user_id=peer)
    token = create_access_token(viewer, settings)

    body = client.get(USER_RECS_PATH, headers={"Authorization": f"Bearer {token}"}).json()

    assert all(item["reason"] != "Customers with similar taste liked this" for item in body["data"]["recommendations"])


def test_user_recommendations_require_a_signed_in_user(client: TestClient):
    response = client.get(USER_RECS_PATH)

    assert response.status_code == 401


def test_similar_excludes_the_product_itself_and_ranks_shared_tags_first(client: TestClient):
    seed_catalog(client)

    body = client.get(f"{SIMILAR_PATH}/3").json()

    assert ids_of(body)[0] == 4
    assert 3 not in ids_of(body)
    assert body["data"]["recommendations"][0]["reason"] == "Similar products"


def test_product_recommendations_include_product_details(client: TestClient):
    seed_catalog(client)

    body = client.get(f"{PRODUCT_RECS_PATH}/1").json()

    assert body["data"]["recommendations"][0]["product"]["name"] == "Nail Polish Red"


def test_frequently_bought_falls_back_to_customers_also_viewed(client: TestClient):
    seed_catalog(client)
    first = make_user(client, "first@example.com")
    second = make_user(client, "second@example.com")
    record(client, "PRODUCT_VIEW", product_id=1, user_id=first)
    record(client, "PRODUCT_VIEW", product_id=3, user_id=first)
    record(client, "PRODUCT_VIEW", product_id=1, user_id=second)

    body = client.get(f"{FREQUENTLY_BOUGHT_PATH}/1").json()

    assert ids_of(body) == [3]
    assert body["data"]["recommendations"][0]["reason"] == "Customers also viewed"


def test_frequently_bought_uses_purchases_when_they_exist(client: TestClient):
    seed_catalog(client)
    buyer = make_user(client, "buyer@example.com")
    record(client, "PURCHASE", product_id=1, user_id=buyer)
    record(client, "PURCHASE", product_id=4, user_id=buyer)

    body = client.get(f"{FREQUENTLY_BOUGHT_PATH}/1").json()

    assert ids_of(body) == [4]
    assert body["data"]["recommendations"][0]["reason"] == "Frequently bought together"
