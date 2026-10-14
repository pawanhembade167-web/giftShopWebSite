from sqlalchemy.orm import Session

from app.models.event import UserEvent
from app.repositories.event_repository import EventRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.events import EventIn
from app.utils.errors import AppError

PRODUCT_NOT_FOUND_MESSAGE = "This product is no longer available."
IDENTITY_REQUIRED_MESSAGE = "Sign in or send an anonymousId to record activity."


class EventService:
    def __init__(self, session: Session):
        self._session = session
        self._events = EventRepository(session)
        self._products = ProductRepository(session)

    def record(self, event: EventIn, user_id: int | None) -> None:
        if user_id is None and event.anonymous_id is None:
            raise AppError(422, IDENTITY_REQUIRED_MESSAGE)
        if event.product_id is not None and self._products.get_active(event.product_id) is None:
            raise AppError(404, PRODUCT_NOT_FOUND_MESSAGE)

        self._events.add(UserEvent(
            user_id=user_id,
            anonymous_id=None if user_id is not None else event.anonymous_id,
            product_id=event.product_id,
            event_type=event.event_type.value,
            query=event.query,
            category_id=event.category_id,
            source=event.source,
        ))
