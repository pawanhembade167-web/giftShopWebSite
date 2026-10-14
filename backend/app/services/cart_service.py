from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.commerce import CartItem, WishlistItem
from app.models.event import EventType
from app.models.event import UserEvent
from app.models.product import Product
from app.repositories.commerce_repository import CartRepository, WishlistRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.catalog import ProductOut
from app.schemas.commerce import MAX_LINE_QUANTITY
from app.services.pricing import compute_totals, money
from app.utils.errors import AppError

PRODUCT_NOT_FOUND_MESSAGE = "This product is no longer available."
OUT_OF_STOCK_MESSAGE = "This item is out of stock."


def _product_or_404(session: Session, product_id: int) -> Product:
    product = ProductRepository(session).get_active(product_id)
    if product is None:
        raise AppError(404, PRODUCT_NOT_FOUND_MESSAGE)
    return product


def _check_addable(product: Product, current_quantity: int, requested: int) -> None:
    if product.stock <= 0:
        raise AppError(422, OUT_OF_STOCK_MESSAGE)
    total = current_quantity + requested
    if total > product.stock:
        raise AppError(422, f"Only {product.stock} left in stock.")
    if total > MAX_LINE_QUANTITY:
        raise AppError(422, f"You can order up to {MAX_LINE_QUANTITY} of each item.")


def _record(session: Session, user_id: int, product_id: int, event_type: EventType) -> None:
    session.add(UserEvent(user_id=user_id, product_id=product_id, event_type=event_type.value, source="cart"))


@dataclass(frozen=True)
class MergeOutcome:
    cart: dict
    skipped: list[dict]


class CartService:
    def __init__(self, session: Session):
        self._session = session
        self._carts = CartRepository(session)
        self._products = ProductRepository(session)

    def view(self, user_id: int) -> dict:
        return self._payload(user_id)

    def add(self, user_id: int, product_id: int, quantity: int) -> dict:
        product = _product_or_404(self._session, product_id)
        existing = self._carts.find(user_id, product_id)
        _check_addable(product, existing.quantity if existing else 0, quantity)
        if existing:
            existing.quantity += quantity
        else:
            self._carts.add(CartItem(user_id=user_id, product_id=product_id, quantity=quantity))
        _record(self._session, user_id, product_id, EventType.ADD_TO_CART)
        self._session.commit()
        return self._payload(user_id)

    def set_quantity(self, user_id: int, product_id: int, quantity: int) -> dict:
        item = self._carts.find(user_id, product_id)
        if item is None:
            raise AppError(404, "That item is not in your cart.")
        _check_addable(_product_or_404(self._session, product_id), 0, quantity)
        item.quantity = quantity
        self._session.commit()
        return self._payload(user_id)

    def remove(self, user_id: int, product_id: int) -> dict:
        item = self._carts.find(user_id, product_id)
        if item is not None:
            self._carts.remove(item)
            _record(self._session, user_id, product_id, EventType.REMOVE_FROM_CART)
            self._session.commit()
        return self._payload(user_id)

    def merge(self, user_id: int, lines: list[tuple[int, int]]) -> MergeOutcome:
        skipped: list[dict] = []
        for product_id, quantity in lines:
            product = self._products.get_active(product_id)
            if product is None:
                skipped.append({"productId": product_id, "reason": "unavailable"})
                continue
            if product.stock <= 0:
                skipped.append({"productId": product_id, "reason": "out-of-stock"})
                continue
            existing = self._carts.find(user_id, product_id)
            current = existing.quantity if existing else 0
            allowed = min(quantity, product.stock - current, MAX_LINE_QUANTITY - current)
            if allowed <= 0:
                skipped.append({"productId": product_id, "reason": "limited"})
                continue
            if allowed < quantity:
                skipped.append({"productId": product_id, "reason": "limited"})
            if existing:
                existing.quantity += allowed
            else:
                self._carts.add(CartItem(user_id=user_id, product_id=product_id, quantity=allowed))
        self._session.commit()
        return MergeOutcome(cart=self._payload(user_id), skipped=skipped)

    def _payload(self, user_id: int) -> dict:
        items = []
        subtotal = 0.0
        for item in self._carts.items_for(user_id):
            product = self._products.get_active(item.product_id)
            if product is None:
                continue
            line_total = money(product.price * item.quantity)
            subtotal += line_total
            items.append({
                "productId": product.id,
                "name": product.name,
                "unitPrice": money(product.price),
                "quantity": item.quantity,
                "lineTotal": line_total,
                "stock": product.stock,
                "product": ProductOut.model_validate(product).model_dump(by_alias=True),
            })
        shipping, tax, total = compute_totals(money(subtotal))
        return {
            "items": items,
            "subtotal": money(subtotal),
            "shipping": shipping,
            "tax": tax,
            "total": total,
            "itemCount": sum(i["quantity"] for i in items),
        }


class WishlistService:
    def __init__(self, session: Session):
        self._session = session
        self._wishlist = WishlistRepository(session)
        self._cart = CartService(session)

    def view(self, user_id: int) -> dict:
        return self._payload(user_id)

    def add(self, user_id: int, product_id: int) -> dict:
        _product_or_404(self._session, product_id)
        if self._wishlist.find(user_id, product_id) is None:
            self._wishlist.add(WishlistItem(user_id=user_id, product_id=product_id))
            _record(self._session, user_id, product_id, EventType.WISHLIST)
            self._session.commit()
        return self._payload(user_id)

    def remove(self, user_id: int, product_id: int) -> dict:
        item = self._wishlist.find(user_id, product_id)
        if item is not None:
            self._wishlist.remove(item)
            self._session.commit()
        return self._payload(user_id)

    def move_to_cart(self, user_id: int, product_id: int) -> dict:
        item = self._wishlist.find(user_id, product_id)
        if item is None:
            raise AppError(404, "That item is not in your wishlist.")
        cart = self._cart.add(user_id, product_id, 1)
        self._wishlist.remove(item)
        self._session.commit()
        return {"wishlist": self._payload(user_id), "cart": cart}

    def _payload(self, user_id: int) -> dict:
        items = []
        for item in self._wishlist.items_for(user_id):
            product = ProductRepository(self._session).get_active(item.product_id)
            if product is None:
                continue
            items.append({"productId": product.id, "product": ProductOut.model_validate(product).model_dump(by_alias=True)})
        return {"items": items, "count": len(items)}
