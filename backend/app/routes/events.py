from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.user import User
from app.routes.auth import get_db_session, get_optional_user
from app.schemas.events import EventIn
from app.services.event_service import EventService

router = APIRouter(prefix="/api", tags=["events"])


def get_event_service(session: Session = Depends(get_db_session)) -> EventService:
    return EventService(session)


@router.post("/events", status_code=201)
def record_event(
    body: EventIn,
    user: User | None = Depends(get_optional_user),
    service: EventService = Depends(get_event_service),
) -> dict:
    service.record(body, user.id if user else None)
    return {"success": True, "data": {}, "message": "Activity recorded."}
