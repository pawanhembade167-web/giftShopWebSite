from collections import OrderedDict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.commerce import CustomHamper, HamperItem
from app.models.product import Product
from app.services.pricing import money
from app.utils.errors import AppError

PRODUCT_NOT_FOUND = "One of the products in your hamper is no longer available."
MAX_LINE_QUANTITY = 20


class HamperService:
    def __init__(self, session: Session):
        self._session = session

    def create(self, user_id: int, *, title: str, occasion: str | None, recipient_name: str, message: str | None,
               budget: float | None, delivery_date: date | None, gift_wrap: bool,
               lines: list[tuple[int, int]]) -> CustomHamper:
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
