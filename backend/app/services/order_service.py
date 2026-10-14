from sqlalchemy.orm import Session

from app.models.commerce import CANCELLABLE_STATUSES, Address, CartItem, Order, OrderItem, OrderStatus, OrderStatusEntry
from app.models.event import EventType, UserEvent
from app.models.product import Product
from app.repositories.commerce_repository import AddressRepository, CartRepository, OrderRepository
from app.services.pricing import compute_totals, money
from app.services.payments import PAYMENT_PENDING, provider_for, record_charge, settle_on_end_of_order
from app.utils.errors import AppError

ADDRESS_NOT_FOUND_MESSAGE = "That address could not be found."
EMPTY_CART_MESSAGE = "Your cart is empty."
ORDER_NOT_FOUND_MESSAGE = "That order could not be found."
NOT_CANCELLABLE_MESSAGE = "This order can no longer be cancelled."


class OrderService:
    def __init__(self, session: Session):
        self._session = session
        self._orders = OrderRepository(session)
        self._addresses = AddressRepository(session)
        self._carts = CartRepository(session)

    def place(self, user_id: int, address_id: int, payment_method: str) -> dict:
        address = self._addresses.get_for_user(user_id, address_id)
        if address is None:
            raise AppError(404, ADDRESS_NOT_FOUND_MESSAGE)

        lines = self._checked_cart_lines(user_id)
        subtotal = money(sum(product.price * quantity for product, quantity in lines))
        shipping, tax, total = compute_totals(subtotal)
        provider_for(payment_method)

        order = Order(
            user_id=user_id,
            status=OrderStatus.PLACED.value,
            payment_method=payment_method,
            payment_status=PAYMENT_PENDING,
            subtotal=subtotal,
            shipping=shipping,
            tax=tax,
            total=total,
            **_address_snapshot(address),
        )
        self._orders.add(order)
        self._session.flush()
        record_charge(self._session, order, total)

        for product, quantity in lines:
            self._orders.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                name=product.name,
                unit_price=money(product.price),
                quantity=quantity,
            ))
            product.stock -= quantity
            self._session.add(UserEvent(user_id=user_id, product_id=product.id,
                                        event_type=EventType.PURCHASE.value, source="checkout"))
        self._orders.add(OrderStatusEntry(order_id=order.id, status=OrderStatus.PLACED.value))
        self._carts.clear(user_id)
        self._session.commit()
        return self.detail(user_id, order.id)

    def list_for(self, user_id: int) -> list[dict]:
        return [self._summary(order) for order in self._orders.for_user(user_id)]

    def detail(self, user_id: int, order_id: int) -> dict:
        order = self._orders.get_for_user(user_id, order_id)
        if order is None:
            raise AppError(404, ORDER_NOT_FOUND_MESSAGE)
        return self._render(order)

    def cancel(self, user_id: int, order_id: int) -> dict:
        order = self._orders.get_for_user(user_id, order_id)
        if order is None:
            raise AppError(404, ORDER_NOT_FOUND_MESSAGE)
        if order.status not in CANCELLABLE_STATUSES:
            raise AppError(422, NOT_CANCELLABLE_MESSAGE)
        for item in self._orders.items(order.id):
            product = self._session.get(Product, item.product_id) if item.product_id else None
            if product is not None:
                product.stock += item.quantity
        order.status = OrderStatus.CANCELLED.value
        settle_on_end_of_order(self._session, order)
        self._orders.add(OrderStatusEntry(order_id=order.id, status=OrderStatus.CANCELLED.value))
        self._session.commit()
        return self._render(order)

    def _checked_cart_lines(self, user_id: int) -> list[tuple[Product, int]]:
        cart_items: list[CartItem] = self._carts.items_for(user_id)
        if not cart_items:
            raise AppError(422, EMPTY_CART_MESSAGE)
        lines: list[tuple[Product, int]] = []
        for item in cart_items:
            product = self._session.get(Product, item.product_id)
            if product is None or not product.is_active or product.stock < item.quantity:
                name = product.name if product else "An item"
                raise AppError(409, f"{name} no longer has enough stock. Update your cart and try again.")
            lines.append((product, item.quantity))
        return lines

    def _summary(self, order: Order) -> dict:
        return {
            "id": order.id,
            "status": order.status,
            "paymentStatus": order.payment_status,
            "total": order.total,
            "itemCount": sum(item.quantity for item in self._orders.items(order.id)),
            "createdAt": order.created_at.isoformat(),
        }

    def _render(self, order: Order) -> dict:
        items = [
            {
                "productId": item.product_id,
                "name": item.name,
                "unitPrice": item.unit_price,
                "quantity": item.quantity,
                "lineTotal": money(item.unit_price * item.quantity),
            }
            for item in self._orders.items(order.id)
        ]
        return {
            "order": {
                **self._summary(order),
                "paymentMethod": order.payment_method,
                "subtotal": order.subtotal,
                "shipping": order.shipping,
                "tax": order.tax,
                "address": {
                    "fullName": order.ship_full_name,
                    "phone": order.ship_phone,
                    "line1": order.ship_line1,
                    "line2": order.ship_line2,
                    "city": order.ship_city,
                    "state": order.ship_state,
                    "postalCode": order.ship_postal_code,
                    "country": order.ship_country,
                },
                "items": items,
                "timeline": [
                    {"status": entry.status, "at": entry.created_at.isoformat()}
                    for entry in self._orders.timeline(order.id)
                ],
            }
        }


def _address_snapshot(address: Address) -> dict:
    return {
        "ship_full_name": address.full_name,
        "ship_phone": address.phone,
        "ship_line1": address.line1,
        "ship_line2": address.line2,
        "ship_city": address.city,
        "ship_state": address.state,
        "ship_postal_code": address.postal_code,
        "ship_country": address.country,
    }
