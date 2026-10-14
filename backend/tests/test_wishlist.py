from fastapi.testclient import TestClient

from app.config.settings import Settings
from tests.factories import add_product, shopper

WISHLIST = "/api/wishlist"


def test_wishlist_requires_sign_in(client: TestClient):
    assert client.get(WISHLIST).status_code == 401


def test_adding_to_wishlist_twice_keeps_one_entry(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1)

    client.post(f"{WISHLIST}/items", json={"productId": product_id}, headers=buyer["headers"])
    response = client.post(f"{WISHLIST}/items", json={"productId": product_id}, headers=buyer["headers"])

    items = response.json()["data"]["wishlist"]["items"]
    assert len(items) == 1
    assert items[0]["product"]["id"] == product_id
    assert response.json()["data"]["wishlist"]["count"] == 1


def test_remove_from_wishlist_deletes_the_entry(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1)
    client.post(f"{WISHLIST}/items", json={"productId": product_id}, headers=buyer["headers"])

    response = client.delete(f"{WISHLIST}/items/{product_id}", headers=buyer["headers"])

    assert response.json()["data"]["wishlist"]["count"] == 0


def test_move_to_cart_removes_from_wishlist_and_adds_to_cart(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=3)
    client.post(f"{WISHLIST}/items", json={"productId": product_id}, headers=buyer["headers"])

    response = client.post(f"{WISHLIST}/items/{product_id}/move-to-cart", headers=buyer["headers"])

    data = response.json()["data"]
    assert data["wishlist"]["count"] == 0
    assert data["cart"]["items"][0]["productId"] == product_id


def test_move_to_cart_of_out_of_stock_item_keeps_it_in_wishlist(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    product_id = add_product(client, 1, stock=0)
    client.post(f"{WISHLIST}/items", json={"productId": product_id}, headers=buyer["headers"])

    response = client.post(f"{WISHLIST}/items/{product_id}/move-to-cart", headers=buyer["headers"])

    assert response.status_code == 422
    assert client.get(WISHLIST, headers=buyer["headers"]).json()["data"]["wishlist"]["count"] == 1
