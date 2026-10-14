from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.routes.auth import get_current_user, get_db_session
from app.schemas.admin import ActiveIn, OrderStatusIn, PaymentIn, ProductAdminIn, StockIn
from app.services.admin_service import AdminService
from app.schemas.catalog import ProductOut
from app.utils.errors import AppError

router = APIRouter(prefix="/api/admin", tags=["admin"])
FORBIDDEN_MESSAGE = "Only store administrators can do this."


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.ADMIN.value:
        raise AppError(403, FORBIDDEN_MESSAGE)
    return user


def get_admin_service(session: Session = Depends(get_db_session)) -> AdminService:
    return AdminService(session)


def _envelope(data: dict, message: str) -> dict:
    return {"success": True, "data": data, "message": message}


@router.get("/dashboard")
def dashboard(_: User = Depends(require_admin), service: AdminService = Depends(get_admin_service)) -> dict:
    return _envelope(service.dashboard(), "Dashboard fetched.")


@router.get("/products")
def list_products(
    page: int = Query(default=1, ge=1),
    pageSize: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return _envelope(service.list_products(page, pageSize), "Products fetched.")


@router.post("/products", status_code=201)
def create_product(body: ProductAdminIn, _: User = Depends(require_admin),
                   service: AdminService = Depends(get_admin_service)) -> dict:
    product = service.create_product(body)
    return _envelope({"product": ProductOut.model_validate(product).model_dump(by_alias=True)}, "Product created.")


@router.put("/products/{product_id}")
def update_product(product_id: int, body: ProductAdminIn, _: User = Depends(require_admin),
                   service: AdminService = Depends(get_admin_service)) -> dict:
    product = service.update_product(product_id, body)
    return _envelope({"product": ProductOut.model_validate(product).model_dump(by_alias=True)}, "Product updated.")


@router.patch("/products/{product_id}/stock")
def update_stock(product_id: int, body: StockIn, _: User = Depends(require_admin),
                 service: AdminService = Depends(get_admin_service)) -> dict:
    product = service.set_stock(product_id, body.stock)
    return _envelope({"product": ProductOut.model_validate(product).model_dump(by_alias=True)}, "Stock updated.")


@router.delete("/products/{product_id}")
def remove_product(product_id: int, _: User = Depends(require_admin),
                   service: AdminService = Depends(get_admin_service)) -> dict:
    service.deactivate_product(product_id)
    return _envelope({}, "Product removed from the shop. Order history is kept.")


@router.get("/orders")
def list_orders(
    status: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=100, ge=1, le=500),
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return _envelope({"orders": service.list_orders(status, limit)}, "Orders fetched.")


@router.patch("/orders/{order_id}/status")
def change_order_status(order_id: int, body: OrderStatusIn, _: User = Depends(require_admin),
                        service: AdminService = Depends(get_admin_service)) -> dict:
    order = service.change_status(order_id, body.status)
    return _envelope({"order": {"id": order.id, "status": order.status}}, "Order status updated.")


@router.patch("/orders/{order_id}/payment")
def mark_paid(order_id: int, body: PaymentIn, _: User = Depends(require_admin),
              service: AdminService = Depends(get_admin_service)) -> dict:
    order = service.mark_cash_paid(order_id)
    return _envelope({"order": {"id": order.id, "paymentStatus": order.payment_status}}, "Payment recorded.")


@router.get("/users")
def list_users(_: User = Depends(require_admin), service: AdminService = Depends(get_admin_service)) -> dict:
    return _envelope({"users": service.list_users()}, "Users fetched.")


@router.patch("/users/{user_id}/active")
def set_user_active(user_id: int, body: ActiveIn, admin: User = Depends(require_admin),
                    service: AdminService = Depends(get_admin_service)) -> dict:
    user = service.set_user_active(admin.id, user_id, body.is_active)
    return _envelope({"user": {"id": user.id, "isActive": user.is_active}}, "User updated.")
