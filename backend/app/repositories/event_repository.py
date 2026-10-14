from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.event import UserEvent


@dataclass(frozen=True)
class StoredInteraction:
    user_key: str
    product_id: int
    event_type: str
    created_at: datetime


def user_key_for(user_id: int | None, anonymous_id: str | None) -> str | None:
    if user_id is not None:
        return f"u:{user_id}"
    if anonymous_id:
        return f"a:{anonymous_id}"
    return None


class EventRepository:
    def __init__(self, session: Session):
        self._session = session

    def add(self, event: UserEvent) -> None:
        self._session.add(event)
        self._session.commit()

    def product_interactions(self) -> list[StoredInteraction]:
        rows = self._session.execute(
            select(UserEvent.user_id, UserEvent.anonymous_id, UserEvent.product_id, UserEvent.event_type, UserEvent.created_at)
            .where(UserEvent.product_id.is_not(None))
        )
        interactions: list[StoredInteraction] = []
        for user_id, anonymous_id, product_id, event_type, created_at in rows:
            key = user_key_for(user_id, anonymous_id)
            if key is None:
                continue
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            interactions.append(StoredInteraction(key, product_id, event_type, created_at))
        return interactions
