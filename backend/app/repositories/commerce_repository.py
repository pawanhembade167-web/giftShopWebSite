from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.commerce import Address, CartItem, Order, OrderItem, OrderStatusEntry, WishlistItem


class CartRepository:
    def __init__(self, session: Session):
        self._session = session

    def items_for(self, user_id: int) -> list[CartItem]:
        return list(self._session.scalars(select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.id)))

    def find(self, user_id: int, product_id: int) -> CartItem | None:
        return self._session.scalar(select(CartItem).where(CartItem.user_id == user_id, CartItem.product_id == product_id))

    def add(self, item: CartItem) -> None:
        self._session.add(item)

    def remove(self, item: CartItem) -> None:
        self._session.delete(item)

    def clear(self, user_id: int) -> None:
        self._session.execute(delete(CartItem).where(CartItem.user_id == user_id))


class WishlistRepository:
    def __init__(self, session: Session):
        self._session = session

    def items_for(self, user_id: int) -> list[WishlistItem]:
        return list(self._session.scalars(select(WishlistItem).where(WishlistItem.user_id == user_id).order_by(WishlistItem.id)))

    def find(self, user_id: int, product_id: int) -> WishlistItem | None:
        return self._session.scalar(select(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.product_id == product_id))

    def add(self, item: WishlistItem) -> None:
        self._session.add(item)

    def remove(self, item: WishlistItem) -> None:
        self._session.delete(item)


class AddressRepository:
    def __init__(self, session: Session):
        self._session = session

    def for_user(self, user_id: int) -> list[Address]:
        return list(self._session.scalars(select(Address).where(Address.user_id == user_id).order_by(Address.id)))

    def get_for_user(self, user_id: int, address_id: int) -> Address | None:
        return self._session.scalar(select(Address).where(Address.id == address_id, Address.user_id == user_id))

    def add(self, address: Address) -> None:
        self._session.add(address)

    def remove(self, address: Address) -> None:
        self._session.delete(address)


class OrderRepository:
    def __init__(self, session: Session):
        self._session = session

    def for_user(self, user_id: int) -> list[Order]:
        return list(self._session.scalars(select(Order).where(Order.user_id == user_id).order_by(Order.id.desc())))

    def get_for_user(self, user_id: int, order_id: int) -> Order | None:
        return self._session.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id))

    def items(self, order_id: int) -> list[OrderItem]:
        return list(self._session.scalars(select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id)))

    def timeline(self, order_id: int) -> list[OrderStatusEntry]:
        return list(self._session.scalars(
            select(OrderStatusEntry).where(OrderStatusEntry.order_id == order_id).order_by(OrderStatusEntry.id)
        ))

    def add(self, entity) -> None:
        self._session.add(entity)
