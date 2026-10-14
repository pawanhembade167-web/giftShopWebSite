from sqlalchemy.orm import Session

from app.models.commerce import Address
from app.repositories.commerce_repository import AddressRepository
from app.schemas.commerce import AddressIn
from app.utils.errors import AppError

ADDRESS_NOT_FOUND_MESSAGE = "That address could not be found."


def address_payload(address: Address) -> dict:
    return {
        "id": address.id,
        "fullName": address.full_name,
        "phone": address.phone,
        "line1": address.line1,
        "line2": address.line2,
        "city": address.city,
        "state": address.state,
        "postalCode": address.postal_code,
        "country": address.country,
        "isDefault": address.is_default,
    }


class AddressService:
    def __init__(self, session: Session):
        self._session = session
        self._addresses = AddressRepository(session)

    def list_for(self, user_id: int) -> list[dict]:
        return [address_payload(address) for address in self._addresses.for_user(user_id)]

    def create(self, user_id: int, body: AddressIn) -> dict:
        existing = self._addresses.for_user(user_id)
        make_default = body.is_default or not existing
        if make_default:
            self._clear_default(user_id)
        address = Address(user_id=user_id, is_default=make_default, **_fields(body))
        self._addresses.add(address)
        self._session.commit()
        return address_payload(address)

    def update(self, user_id: int, address_id: int, body: AddressIn) -> dict:
        address = self._owned(user_id, address_id)
        if body.is_default:
            self._clear_default(user_id)
        for key, value in _fields(body).items():
            setattr(address, key, value)
        address.is_default = body.is_default or address.is_default
        self._session.commit()
        return address_payload(address)

    def delete(self, user_id: int, address_id: int) -> None:
        address = self._owned(user_id, address_id)
        was_default = address.is_default
        self._addresses.remove(address)
        self._session.flush()
        if was_default:
            remaining = self._addresses.for_user(user_id)
            if remaining:
                remaining[0].is_default = True
        self._session.commit()

    def _owned(self, user_id: int, address_id: int) -> Address:
        address = self._addresses.get_for_user(user_id, address_id)
        if address is None:
            raise AppError(404, ADDRESS_NOT_FOUND_MESSAGE)
        return address

    def _clear_default(self, user_id: int) -> None:
        for address in self._addresses.for_user(user_id):
            address.is_default = False


def _fields(body: AddressIn) -> dict:
    return {
        "full_name": body.full_name,
        "phone": body.phone,
        "line1": body.line1,
        "line2": body.line2,
        "city": body.city,
        "state": body.state,
        "postal_code": body.postal_code,
        "country": body.country,
    }
