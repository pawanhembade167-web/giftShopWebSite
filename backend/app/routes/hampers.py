from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from app.models.commerce import CustomHamper, HamperItem
from app.models.user import User
from app.routes.admin import require_admin
from app.routes.auth import get_current_user, get_db_session
from app.services.hamper_service import HamperService

router = APIRouter(prefix="/api/hampers", tags=["hampers"])
admin_router = APIRouter(prefix="/api/admin/hampers", tags=["admin"])

MAX_HAMPER_LINES = 30


class HamperLineIn(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    product_id: int
    quantity: int = Field(ge=1, le=20)


class HamperIn(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str = Field(min_length=2, max_length=120)
    occasion: str | None = Field(default=None, max_length=60)
    recipient_name: str = Field(min_length=2, max_length=100)
    message: str | None = Field(default=None, max_length=300)
    budget: float | None = Field(default=None, gt=0, le=1_000_000)
    delivery_date: date | None = None
    gift_wrap: bool = False
    items: list[HamperLineIn] = Field(min_length=1, max_length=MAX_HAMPER_LINES)

    @model_validator(mode="after")
    def reject_past_delivery_dates(self) -> "HamperIn":
        if self.delivery_date is not None and self.delivery_date < date.today():
            raise ValueError("Choose a delivery date that is today or later.")
        return self


def get_hamper_service(session: Session = Depends(get_db_session)) -> HamperService:
    return HamperService(session)


def _hamper_payload(hamper: CustomHamper, items: list[HamperItem]) -> dict:
    return {
        "id": hamper.id,
        "title": hamper.title,
        "occasion": hamper.occasion,
        "recipientName": hamper.recipient_name,
        "message": hamper.message,
        "budget": hamper.budget,
        "deliveryDate": hamper.delivery_date.isoformat() if hamper.delivery_date else None,
        "giftWrap": hamper.gift_wrap,
        "estimatedTotal": hamper.estimated_total,
        "status": hamper.status,
        "createdAt": hamper.created_at.isoformat(),
        "items": [
            {"productId": item.product_id, "name": item.name, "unitPrice": item.unit_price,
             "quantity": item.quantity, "lineTotal": round(item.unit_price * item.quantity, 2)}
            for item in items
        ],
    }


def _envelope(data: dict, message: str) -> dict:
    return {"success": True, "data": data, "message": message}


@router.post("", status_code=201)
def create_hamper(body: HamperIn, user: User = Depends(get_current_user),
                  service: HamperService = Depends(get_hamper_service)) -> dict:
    hamper = service.create(
        user.id,
        title=body.title.strip(),
        occasion=body.occasion,
        recipient_name=body.recipient_name.strip(),
        message=(body.message or "").strip() or None,
        budget=body.budget,
        delivery_date=body.delivery_date,
        gift_wrap=body.gift_wrap,
        lines=[(line.product_id, line.quantity) for line in body.items],
    )
    return _envelope({"hamper": _hamper_payload(hamper, service.items(hamper.id))}, "Your hamper request has been sent.")


@router.get("")
def my_hampers(user: User = Depends(get_current_user), service: HamperService = Depends(get_hamper_service)) -> dict:
    hampers = [_hamper_payload(h, service.items(h.id)) for h in service.for_user(user.id)]
    return _envelope({"hampers": hampers}, "Your hampers fetched.")


@admin_router.get("")
def all_hampers(_: User = Depends(require_admin), service: HamperService = Depends(get_hamper_service)) -> dict:
    hampers = [_hamper_payload(h, service.items(h.id)) for h in service.all()]
    return _envelope({"hampers": hampers}, "Hamper requests fetched.")
