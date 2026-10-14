import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models.event import EventType
from app.recommendation.model import (
    REASON_CONTENT_FOR_PRODUCT,
    REASON_CONTENT_FOR_USER,
    REASON_CUSTOMERS_ALSO_VIEWED,
    REASON_FREQUENTLY_BOUGHT,
    REASON_POPULAR,
    REASON_TOP_RATED,
    Interaction,
    ProductSignal,
    RecommendationModel,
    Scored,
)
from app.repositories.event_repository import EventRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.catalog import ProductOut
from app.utils.errors import AppError

PRODUCT_NOT_FOUND_MESSAGE = "This product is no longer available."


@dataclass
class ModelCache:
    model: RecommendationModel | None = None
    built_at: float = 0.0
    clock: Callable[[], float] = field(default=time.monotonic)


@dataclass(frozen=True)
class Recommendations:
    strategy: str
    items: list[Scored]


class RecommendationService:
    def __init__(self, session: Session, settings: Settings, cache: ModelCache):
        self._session = session
        self._settings = settings
        self._cache = cache

    def for_home(self, user_key: str | None, limit: int) -> Recommendations:
        model = self._model()
        if user_key and model.profile(user_key):
            return self._personalised(model, user_key, limit)
        return Recommendations(
            "cold-start",
            model.recommend({}, set(), limit, self._weights(), REASON_CONTENT_FOR_USER, REASON_TOP_RATED),
        )

    def for_user(self, user_key: str, limit: int) -> Recommendations:
        model = self._model()
        return self._personalised(model, user_key, limit)

    def for_product(self, product_id: int, limit: int) -> Recommendations:
        model = self._require_product(product_id)
        return Recommendations(
            "hybrid",
            model.recommend({product_id: 1.0}, {product_id}, limit, self._weights(),
                            REASON_CONTENT_FOR_PRODUCT, REASON_POPULAR),
        )

    def similar(self, product_id: int, limit: int) -> Recommendations:
        model = self._require_product(product_id)
        content_only = {"content": 1.0, "collaborative": 0.0, "popularity": 0.0, "recency": 0.0}
        return Recommendations(
            "content",
            model.recommend({product_id: 1.0}, {product_id}, limit, content_only,
                            REASON_CONTENT_FOR_PRODUCT, REASON_POPULAR),
        )

    def frequently_bought(self, product_id: int, limit: int) -> Recommendations:
        model = self._require_product(product_id)
        bought = model.co_occurring(product_id, (EventType.PURCHASE.value,), (EventType.PURCHASE.value,))
        if bought:
            items = self._ranked(model, bought, limit, REASON_FREQUENTLY_BOUGHT)
            return Recommendations("co-purchase", items)
        viewed = model.co_occurring(product_id, (EventType.PRODUCT_VIEW.value,), (EventType.PRODUCT_VIEW.value,))
        return Recommendations("co-view", self._ranked(model, viewed, limit, REASON_CUSTOMERS_ALSO_VIEWED))

    def render(self, recommendations: Recommendations) -> list[dict]:
        model = self._model()
        return [
            {
                "productId": item.product_id,
                "score": item.score,
                "reason": item.reason,
                "product": model.payload(item.product_id),
            }
            for item in recommendations.items
        ]

    def _personalised(self, model: RecommendationModel, user_key: str, limit: int) -> Recommendations:
        return Recommendations(
            "personalized",
            model.recommend(
                model.profile(user_key),
                model.interacted(user_key),
                limit,
                self._weights(),
                REASON_CONTENT_FOR_USER,
                REASON_POPULAR,
            ),
        )

    def _ranked(self, model: RecommendationModel, scores: dict[int, float], limit: int, reason: str) -> list[Scored]:
        ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))[:limit]
        return [Scored(product_id, round(score, 4), reason) for product_id, score in ranked]

    def _require_product(self, product_id: int) -> RecommendationModel:
        model = self._model()
        if not model.is_known(product_id):
            raise AppError(404, PRODUCT_NOT_FOUND_MESSAGE)
        return model

    def _weights(self) -> dict[str, float]:
        return {
            "content": self._settings.rec_content_weight,
            "collaborative": self._settings.rec_collaborative_weight,
            "popularity": self._settings.rec_popularity_weight,
            "recency": self._settings.rec_recency_weight,
        }

    def _model(self) -> RecommendationModel:
        ttl = self._settings.rec_cache_seconds
        now = self._cache.clock()
        if self._cache.model is not None and ttl > 0 and now - self._cache.built_at < ttl:
            return self._cache.model
        model = self._build()
        self._cache.model = model
        self._cache.built_at = now
        return model

    def _build(self) -> RecommendationModel:
        categories = {category.id: category.name for category in ProductRepository(self._session).categories()}
        signals = []
        for product in ProductRepository(self._session).all_active():
            category_name = categories.get(product.category_id, "")
            text = " ".join(part for part in (product.name, product.brand or "", category_name, product.tags, product.description or "") if part)
            signals.append(ProductSignal(
                product_id=product.id,
                text=text,
                rating=product.rating,
                review_count=product.review_count,
                payload=ProductOut.model_validate(product).model_dump(by_alias=True),
            ))

        interactions = [
            Interaction(stored.user_key, stored.product_id, stored.event_type, stored.created_at)
            for stored in EventRepository(self._session).product_interactions()
        ]
        return RecommendationModel(
            signals,
            interactions,
            datetime.now(timezone.utc),
            self._settings.rec_min_active_users,
        )
