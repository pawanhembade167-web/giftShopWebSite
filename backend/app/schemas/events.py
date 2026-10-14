from pydantic import Field, model_validator
from pydantic.alias_generators import to_camel
from pydantic import BaseModel, ConfigDict

from app.models.event import PRODUCT_EVENT_TYPES, EventType


class EventIn(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    event_type: EventType
    product_id: int | None = None
    query: str | None = Field(default=None, max_length=120)
    category_id: int | None = None
    anonymous_id: str | None = Field(default=None, min_length=8, max_length=64)
    source: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def require_product_for_product_events(self) -> "EventIn":
        if self.event_type in PRODUCT_EVENT_TYPES and self.product_id is None:
            raise ValueError("productId is required for this event type.")
        return self
