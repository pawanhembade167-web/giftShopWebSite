from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.models.user import User
from app.routes.auth import get_current_user, get_db_session
from app.schemas.commerce import AddressIn, CartItemIn, CartQuantityIn, MergeIn, PlaceOrderIn, WishlistItemIn
from app.services.address_service import AddressService
from app.services.cart_service import CartService, WishlistService
from app.services.order_service import OrderService

cart_router = APIRouter(prefix="/api/cart", tags=["cart"])
wishlist_router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])
address_router = APIRouter(prefix="/api/addresses", tags=["addresses"])
order_router = APIRouter(prefix="/api/orders", tags=["orders"])


def _envelope(data: dict, message: str) -> dict:
    return {"success": True, "data": data, "message": message}


# Cart

@cart_router.get("")
def view_cart(user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"cart": CartService(session).view(user.id)}, "Cart fetched.")


@cart_router.post("/items")
def add_to_cart(body: CartItemIn, user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"cart": CartService(session).add(user.id, body.product_id, body.quantity)}, "Added to your cart.")


@cart_router.patch("/items/{product_id}")
def update_cart_line(product_id: int, body: CartQuantityIn, user: User = Depends(get_current_user),
                     session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"cart": CartService(session).set_quantity(user.id, product_id, body.quantity)}, "Cart updated.")


@cart_router.delete("/items/{product_id}")
def remove_from_cart(product_id: int, user: User = Depends(get_current_user),
                     session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"cart": CartService(session).remove(user.id, product_id)}, "Removed from your cart.")


@cart_router.post("/merge")
def merge_guest_cart(body: MergeIn, user: User = Depends(get_current_user),
                     session: Session = Depends(get_db_session)) -> dict:
    outcome = CartService(session).merge(user.id, [(item.product_id, item.quantity) for item in body.items])
    return _envelope({"cart": outcome.cart, "skipped": outcome.skipped}, "Your saved cart has been merged.")


# Wishlist

@wishlist_router.get("")
def view_wishlist(user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"wishlist": WishlistService(session).view(user.id)}, "Wishlist fetched.")


@wishlist_router.post("/items")
def add_to_wishlist(body: WishlistItemIn, user: User = Depends(get_current_user),
                    session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"wishlist": WishlistService(session).add(user.id, body.product_id)}, "Saved to your wishlist.")


@wishlist_router.delete("/items/{product_id}")
def remove_from_wishlist(product_id: int, user: User = Depends(get_current_user),
                         session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"wishlist": WishlistService(session).remove(user.id, product_id)}, "Removed from your wishlist.")


@wishlist_router.post("/items/{product_id}/move-to-cart")
def move_wishlist_item_to_cart(product_id: int, user: User = Depends(get_current_user),
                               session: Session = Depends(get_db_session)) -> dict:
    return _envelope(WishlistService(session).move_to_cart(user.id, product_id), "Moved to your cart.")


# Addresses

@address_router.get("")
def list_addresses(user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"addresses": AddressService(session).list_for(user.id)}, "Addresses fetched.")


@address_router.post("", status_code=201)
def create_address(body: AddressIn, user: User = Depends(get_current_user),
                   session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"address": AddressService(session).create(user.id, body)}, "Address saved.")


@address_router.put("/{address_id}")
def update_address(address_id: int, body: AddressIn, user: User = Depends(get_current_user),
                   session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"address": AddressService(session).update(user.id, address_id, body)}, "Address updated.")


@address_router.delete("/{address_id}")
def delete_address(address_id: int, user: User = Depends(get_current_user),
                   session: Session = Depends(get_db_session)) -> dict:
    AddressService(session).delete(user.id, address_id)
    return _envelope({}, "Address removed.")


# Orders

@order_router.get("")
def list_orders(user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope({"orders": OrderService(session).list_for(user.id)}, "Orders fetched.")


@order_router.post("", status_code=201)
def place_order(body: PlaceOrderIn, user: User = Depends(get_current_user),
                session: Session = Depends(get_db_session)) -> dict:
    data = OrderService(session).place(user.id, body.address_id, body.payment_method)
    return _envelope(data, "Order placed successfully.")


@order_router.get("/{order_id}")
def get_order(order_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db_session)) -> dict:
    return _envelope(OrderService(session).detail(user.id, order_id), "Order fetched.")


@order_router.post("/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(get_current_user),
                 session: Session = Depends(get_db_session)) -> dict:
    return _envelope(OrderService(session).cancel(user.id, order_id), "Order cancelled.")
