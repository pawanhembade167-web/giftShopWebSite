from collections import OrderedDict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.commerce import CustomHamper, HamperItem, Order, OrderItem, OrderStatus, OrderStatusEntry
from app.models.product import Product
from app.repositories.commerce_repository import AddressRepository
from app.services.order_service import address_snapshot
from app.services.payments import PAYMENT_PENDING, PaymentMethod, record_charge
from app.services.pricing import compute_totals, money
from app.utils.errors import AppError

ADDRESS_NOT_FOUND = "That address could not be found."
ADDRESS_MISSING = "This hamper has no delivery address, so it cannot become an order."
PRODUCT_NOT_FOUND = "One of the products in your hamper is no longer available."
MAX_LINE_QUANTITY = 20


class HamperService:
    def __init__(self, session: Session):
        self._session = session

    def create(self, user_id: int, *, title: str, occasion: str | None, recipient_name: str, message: str | None,
               budget: float | None, delivery_date: date | None, gift_wrap: bool, address_id: int,
               lines: list[tuple[int, int]]) -> CustomHamper:
        address = AddressRepository(self._session).get_for_user(user_id, address_id)
        if address is None:
            raise AppError(404, ADDRESS_NOT_FOUND)
        combined = self._combine(lines)
        products = [self._product(product_id, quantity) for product_id, quantity in combined]
        estimated = money(sum(product.price * quantity for product, quantity in products))
        hamper = CustomHamper(
            user_id=user_id,
            title=title,
            occasion=occasion,
            recipient_name=recipient_name,
            message=message,
            budget=budget,
            delivery_date=delivery_date,
            gift_wrap=gift_wrap,
            estimated_total=estimated,
            status="REQUESTED",
            address_id=address.id,
        )
        self._session.add(hamper)
        self._session.flush()
        for product, quantity in products:
            self._session.add(HamperItem(
                hamper_id=hamper.id,
                product_id=product.id,
                name=product.name,
                unit_price=money(product.price),
                quantity=quantity,
            ))
        self._session.commit()
        return hamper

    def for_user(self, user_id: int) -> list[CustomHamper]:
        return list(self._session.scalars(
            select(CustomHamper).where(CustomHamper.user_id == user_id).order_by(CustomHamper.id.desc())
        ))

    def all(self) -> list[CustomHamper]:
        return list(self._session.scalars(select(CustomHamper).order_by(CustomHamper.id.desc())))

    def decide(self, hamper_id: int, status: str) -> CustomHamper:
        hamper = self._session.get(CustomHamper, hamper_id)
        if hamper is None:
            raise AppError(404, "Hamper request not found.")
        if hamper.status != "REQUESTED":
            raise AppError(422, f"This hamper is already {hamper.status.lower()}.")
        if status == "ACCEPTED":
            self._place_order(hamper)
        hamper.status = status
        self._session.commit()
        return hamper

    def _place_order(self, hamper: CustomHamper) -> None:
        items = self.items(hamper.id)
        products = [self._product(item.product_id, item.quantity) for item in items]
        address = AddressRepository(self._session).get_for_user(hamper.user_id, hamper.address_id) if hamper.address_id else None
        if address is None:
            raise AppError(422, ADDRESS_MISSING)
        subtotal = money(hamper.estimated_total)
        shipping, tax, total = compute_totals(subtotal)
        order = Order(
            user_id=hamper.user_id,
            status=OrderStatus.PLACED.value,
            payment_method=PaymentMethod.COD.value,
            payment_status=PAYMENT_PENDING,
            subtotal=subtotal,
            shipping=shipping,
            tax=tax,
            total=total,
            **address_snapshot(address),
        )
        self._session.add(order)
        self._session.flush()
        record_charge(self._session, order, total)
        for item, (product, quantity) in zip(items, products):
            self._session.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                name=product.name,
                unit_price=money(product.price),
                quantity=quantity,
            ))
            product.stock -= quantity
        self._session.add(OrderStatusEntry(order_id=order.id, status=OrderStatus.PLACED.value))
        hamper.order_id = order.id

    def items(self, hamper_id: int) -> list[HamperItem]:
        return list(self._session.scalars(select(HamperItem).where(HamperItem.hamper_id == hamper_id).order_by(HamperItem.id)))

    @staticmethod
    def _combine(lines: list[tuple[int, int]]) -> list[tuple[int, int]]:
        totals: "OrderedDict[int, int]" = OrderedDict()
        for product_id, quantity in lines:
            totals[product_id] = totals.get(product_id, 0) + quantity
        return list(totals.items())

    def _product(self, product_id: int, quantity: int) -> tuple[Product, int]:
        product = self._session.get(Product, product_id)
        if product is None or not product.is_active:
            raise AppError(404, PRODUCT_NOT_FOUND)
        if quantity > MAX_LINE_QUANTITY:
            raise AppError(422, f"You can add up to {MAX_LINE_QUANTITY} of each item.")
        if quantity > product.stock:
            raise AppError(422, f"Only {product.stock} left of {product.name}.")
        return product, quantity
