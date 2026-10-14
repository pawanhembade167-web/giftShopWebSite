from fastapi.testclient import TestClient

from app.config.settings import Settings
from tests.factories import add_address, shopper

ADDRESSES = "/api/addresses"


def test_first_address_becomes_the_default(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)

    address_id = add_address(client, buyer["headers"])

    addresses = client.get(ADDRESSES, headers=buyer["headers"]).json()["data"]["addresses"]
    assert addresses[0]["id"] == address_id
    assert addresses[0]["isDefault"] is True


def test_marking_a_new_address_default_clears_the_previous_default(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    first = add_address(client, buyer["headers"], line1="1 First Street")
    body = {
        "fullName": "Test Shopper", "phone": "9876543210", "line1": "2 Second Street", "line2": None,
        "city": "Pune", "state": "Maharashtra", "postalCode": "411001", "country": "IN", "isDefault": True,
    }
    client.post(ADDRESSES, json=body, headers=buyer["headers"])

    addresses = client.get(ADDRESSES, headers=buyer["headers"]).json()["data"]["addresses"]
    defaults = {address["id"]: address["isDefault"] for address in addresses}
    assert defaults[first] is False
    assert sum(defaults.values()) == 1


def test_another_shopper_cannot_delete_my_address(client: TestClient, settings: Settings):
    owner = shopper(client, settings, "owner@example.com")
    intruder = shopper(client, settings, "intruder@example.com")
    address_id = add_address(client, owner["headers"])

    response = client.delete(f"{ADDRESSES}/{address_id}", headers=intruder["headers"])

    assert response.status_code == 404
    assert len(client.get(ADDRESSES, headers=owner["headers"]).json()["data"]["addresses"]) == 1


def test_deleting_the_default_promotes_the_next_address(client: TestClient, settings: Settings):
    buyer = shopper(client, settings)
    first = add_address(client, buyer["headers"], line1="1 First Street")
    second = add_address(client, buyer["headers"], line1="2 Second Street")

    client.delete(f"{ADDRESSES}/{first}", headers=buyer["headers"])

    addresses = client.get(ADDRESSES, headers=buyer["headers"]).json()["data"]["addresses"]
    assert [a["id"] for a in addresses] == [second]
    assert addresses[0]["isDefault"] is True
