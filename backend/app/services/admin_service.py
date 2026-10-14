from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.commerce import CANCELLABLE_STATUSES, Order, OrderItem, OrderStatus, OrderStatusEntry
from app.models.product import Product
from app.models.user import Role, User
from app.schemas.admin import ProductAdminIn
from app.schemas.catalog import ProductOut
from app.services.pricing import money
from app.services.payments import mark_cash_paid as record_cash_paid, settle_on_end_of_order
from app.utils.errors import AppError

LOW_STOCK_THRESHOLD = 5
PENDING_STATUSES = (OrderStatus.PLACED.value, OrderStatus.CONFIRMED.value, OrderStatus.PROCESSING.value)

# Each status may only move to the statuses listed. Orders cannot skip steps.
ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    OrderStatus.PLACED.value: frozenset({OrderStatus.CONFIRMED.value, OrderStatus.CANCELLED.value}),
    OrderStatus.CONFIRMED.value: frozenset({OrderStatus.PROCESSING.value, OrderStatus.CANCELLED.value}),
    OrderStatus.PROCESSING.value: frozenset({OrderStatus.SHIPPED.value}),
    OrderStatus.SHIPPED.value: frozenset({OrderStatus.OUT_FOR_DELIVERY.value}),
    OrderStatus.OUT_FOR_DELIVERY.value: frozenset({OrderStatus.DELIVERED.value}),
    OrderStatus.DELIVERED.value: frozenset({OrderStatus.RETURNED.value}),
    OrderStatus.CANCELLED.value: frozenset(),
    OrderStatus.RETURNED.value: frozenset(),
}

PRODUCT_NOT_FOUND = "That product could not be found."
ORDER_NOT_FOUND = "That order could not be found."
USER_NOT_FOUND = "That user could not be found."


def _product_payload(product: Product) -> dict:
    return ProductOut.model_validate(product).model_dump(by_alias=True)


class AdminService:
    def __init__(self, session: Session):
        self._session = session

    # Dashboard

    def dashboard(self) -> dict:
        revenue = self._session.scalar(
            select(func.coalesce(func.sum(Order.total), 0.0)).where(Order.status != OrderStatus.CANCELLED.value)
        )
        return {
            "totalOrders": self._session.scalar(select(func.count(Order.id))) or 0,
            "pendingOrders": self._session.scalar(
                select(func.count(Order.id)).where(Order.status.in_(PENDING_STATUSES))
            ) or 0,
            "revenue": money(float(revenue or 0)),
            "totalCustomers": self._session.scalar(
                select(func.count(User.id)).where(User.role == Role.CUSTOMER.value)
            ) or 0,
            "totalProducts": self._session.scalar(
                select(func.count(Product.id)).where(Product.is_active.is_(True))
            ) or 0,
            "lowStockProducts": self._session.scalar(
                select(func.count(Product.id)).where(
                    Product.is_active.is_(True), Product.stock <= LOW_STOCK_THRESHOLD
                )
            ) or 0,
        }

    # Products

    def list_products(self, page: int, page_size: int) -> dict:
        total = self._session.scalar(select(func.count(Product.id))) or 0
        items = self._session.scalars(
            select(Product).order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size)
        )
        return {
            "items": [{**_product_payload(p), "isActive": p.is_active} for p in items],
            "page": page,
            "pageSize": page_size,
            "total": total,
        }

    def create_product(self, body: ProductAdminIn) -> Product:
        self._check_category(body.category_id)
        next_source_id = (self._session.scalar(select(func.max(Product.source_id))) or 0) + 1
        product = Product(source_id=next_source_id, **self._product_fields(body))
        self._session.add(product)
        self._session.commit()
        return product

    def update_product(self, product_id: int, body: ProductAdminIn) -> Product:
        product = self._product(product_id)
        self._check_category(body.category_id)
        for key, value in self._product_fields(body).items():
            setattr(product, key, value)
        self._session.commit()
        return product

    def set_stock(self, product_id: int, stock: int) -> Product:
        product = self._product(product_id)
        product.stock = stock
        self._session.commit()
        return product

    def deactivate_product(self, product_id: int) -> None:
        product = self._product(product_id)
        product.is_active = False
        self._session.commit()

    # Orders

    def list_orders(self, status: str | None, page_size: int) -> list[dict]:
        statement = select(Order).order_by(Order.id.desc()).limit(page_size)
        if status:
            statement = statement.where(Order.status == status)
        return [self._order_summary(order) for order in self._session.scalars(statement)]

    def change_status(self, order_id: int, target: str) -> Order:
        order = self._order(order_id)
        if target not in ALLOWED_TRANSITIONS[order.status]:
            raise AppError(422, f"An order that is {order.status.lower().replace('_', ' ')} cannot move to {target.lower().replace('_', ' ')}.")
        if target == OrderStatus.CANCELLED.value:
            self._restock(order)
        if target in (OrderStatus.CANCELLED.value, OrderStatus.RETURNED.value):
            settle_on_end_of_order(self._session, order)
        order.status = target
        self._session.add(OrderStatusEntry(order_id=order.id, status=target))
        self._session.commit()
        return order

    def mark_cash_paid(self, order_id: int) -> Order:
        order = self._order(order_id)
        if order.payment_method != "COD":
            raise AppError(422, "Only cash on delivery orders are marked paid here.")
        if order.status != OrderStatus.DELIVERED.value:
            raise AppError(422, "Mark the order paid once it has been delivered.")
        if order.payment_status == "PAID":
            raise AppError(422, "This order is already paid.")
        record_cash_paid(self._session, order)
        self._session.commit()
        return order

    # Users

    def list_users(self) -> list[dict]:
        rows = self._session.execute(
            select(User, func.count(Order.id))
            .outerjoin(Order, Order.user_id == User.id)
            .group_by(User.id)
            .order_by(User.id)
        ).all()
        return [
            {
                "id": user.id,
                "fullName": user.full_name,
                "email": user.email,
                "role": user.role,
                "isActive": user.is_active,
                "orderCount": count,
                "createdAt": user.created_at.isoformat(),
            }
            for user, count in rows
        ]

    def set_user_active(self, acting_admin_id: int, user_id: int, is_active: bool) -> User:
        user = self._session.get(User, user_id)
        if user is None:
            raise AppError(404, USER_NOT_FOUND)
        if user.id == acting_admin_id and not is_active:
            raise AppError(422, "You cannot deactivate your own account.")
        user.is_active = is_active
        self._session.commit()
        return user

    # Helpers

    def _product(self, product_id: int) -> Product:
        product = self._session.get(Product, product_id)
        if product is None:
            raise AppError(404, PRODUCT_NOT_FOUND)
        return product

    def _order(self, order_id: int) -> Order:
        order = self._session.get(Order, order_id)
        if order is None:
            raise AppError(404, ORDER_NOT_FOUND)
        return order

    def _check_category(self, category_id: int | None) -> None:
        if category_id is not None and self._session.get(Category, category_id) is None:
            raise AppError(422, "Choose an existing category.")

    def _restock(self, order: Order) -> None:
        if order.status not in CANCELLABLE_STATUSES:
            raise AppError(422, "This order can no longer be cancelled.")
        for item in self._session.scalars(select(OrderItem).where(OrderItem.order_id == order.id)):
            product = self._session.get(Product, item.product_id) if item.product_id else None
            if product is not None:
                product.stock += item.quantity

    def _order_summary(self, order: Order) -> dict:
        return {
            "id": order.id,
            "userId": order.user_id,
            "customer": order.ship_full_name,
            "status": order.status,
            "paymentMethod": order.payment_method,
            "paymentStatus": order.payment_status,
            "total": order.total,
            "createdAt": order.created_at.isoformat(),
        }

    @staticmethod
    def _product_fields(body: ProductAdminIn) -> dict:
        return {
            "name": body.name,
            "brand": body.brand,
            "category_id": body.category_id,
            "subcategory": body.subcategory,
            "product_type": body.product_type,
            "price": body.price,
            "rating": body.rating,
            "review_count": body.review_count,
            "image_url": body.image_url,
            "description": body.description,
            "tags": body.tags,
            "stock": body.stock,
            "is_active": body.is_active,
        }

