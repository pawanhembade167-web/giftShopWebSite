from fastapi.testclient import TestClient

from app.auth.security import create_access_token
from app.config.settings import Settings
from app.models.category import Category
from app.models.product import Product
from app.models.user import User


def add_product(client: TestClient, source_id: int, *, price: float = 100.0, stock: int = 10,
                name: str | None = None, active: bool = True) -> int:
    session = client.app.state.session_factory()
    category = session.query(Category).filter_by(slug="general").one_or_none()
    if category is None:
        category = Category(name="General", slug="general")
        session.add(category)
        session.flush()
    product = Product(
        source_id=source_id,
        name=name or f"Product {source_id}",
        brand="Brand",
        category_id=category.id,
        price=price,
        rating=4.0,
        review_count=5,
        tags="general item",
        description="Description",
        stock=stock,
        is_active=active,
    )
    session.add(product)
    session.commit()
    product_id = product.id
    session.close()
    return product_id


def shopper(client: TestClient, settings: Settings, email: str = "shopper@example.com") -> dict:
    session = client.app.state.session_factory()
    user = User(full_name="Test Shopper", email=email, phone="9876543210", password_hash="x", role="CUSTOMER")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    token = create_access_token(user_id, settings)
    return {"id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def stock_of(client: TestClient, product_id: int) -> int:
    session = client.app.state.session_factory()
    stock = session.get(Product, product_id).stock
    session.close()
    return stock


def admin(client: TestClient, settings: Settings, email: str = "admin@example.com") -> dict:
    session = client.app.state.session_factory()
    user = User(full_name="Store Admin", email=email, phone="9876543210", password_hash="x", role="ADMIN")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    token = create_access_token(user_id, settings)
    return {"id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


def add_address(client: TestClient, headers: dict, line1: str = "12 MG Road") -> int:
    body = {
        "fullName": "Test Shopper",
        "phone": "9876543210",
        "line1": line1,
        "line2": None,
        "city": "Bengaluru",
        "state": "Karnataka",
        "postalCode": "560001",
        "country": "IN",
    }
    response = client.post("/api/addresses", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()["data"]["address"]["id"]
