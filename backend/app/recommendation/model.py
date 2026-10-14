"""Pure recommendation logic: no database or HTTP access, so every rule is unit-testable."""

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime

EVENT_WEIGHTS: dict[str, float] = {
    "PRODUCT_VIEW": 1.0,
    "PRODUCT_CLICK": 1.5,
    "WISHLIST": 3.0,
    "ADD_TO_CART": 4.0,
    "REMOVE_FROM_CART": -2.0,
    "PURCHASE": 5.0,
}
RECENCY_WINDOW_DAYS = 7.0
POPULARITY_INTERACTION_BONUS = 0.5

REASON_CONTENT_FOR_USER = "Similar to what you viewed"
REASON_CONTENT_FOR_PRODUCT = "Similar products"
REASON_COLLABORATIVE = "Customers with similar taste liked this"
REASON_POPULAR = "Popular with shoppers"
REASON_TOP_RATED = "Top rated"
REASON_TRENDING = "Trending right now"
REASON_FREQUENTLY_BOUGHT = "Frequently bought together"
REASON_CUSTOMERS_ALSO_VIEWED = "Customers also viewed"

STOPWORDS = frozenset({"the", "and", "for", "with", "of", "a", "an", "in", "to", "by", "on", "pack", "count", "oz"})
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class ProductSignal:
    product_id: int
    text: str
    rating: float
    review_count: int
    payload: dict = field(compare=False, hash=False, default_factory=dict)


@dataclass(frozen=True)
class Interaction:
    user_key: str
    product_id: int
    event_type: str
    created_at: datetime


@dataclass(frozen=True)
class Scored:
    product_id: int
    score: float
    reason: str


def tokenize(text: str) -> list[str]:
    return [token for token in TOKEN_PATTERN.findall(text.lower()) if len(token) > 1 and token not in STOPWORDS]


def tfidf_vectors(texts: dict[int, str]) -> dict[int, dict[str, float]]:
    documents = {product_id: Counter(tokenize(text)) for product_id, text in texts.items()}
    document_count = len(documents)
    document_frequency = Counter(term for counts in documents.values() for term in counts)

    vectors: dict[int, dict[str, float]] = {}
    for product_id, counts in documents.items():
        weights = {
            term: (1 + math.log(count)) * (math.log((1 + document_count) / (1 + document_frequency[term])) + 1)
            for term, count in counts.items()
        }
        vectors[product_id] = _unit(weights)
    return vectors


def cosine(left: dict[str, float], right: dict[str, float]) -> float:
    smaller, larger = (left, right) if len(left) <= len(right) else (right, left)
    return sum(value * larger.get(term, 0.0) for term, value in smaller.items())


def _unit(vector: dict[str, float]) -> dict[str, float]:
    length = math.sqrt(sum(value * value for value in vector.values()))
    if length == 0:
        return {}
    return {term: value / length for term, value in vector.items()}


def _normalise(scores: dict[int, float]) -> dict[int, float]:
    highest = max(scores.values(), default=0.0)
    if highest <= 0:
        return {}
    return {key: value / highest for key, value in scores.items() if value > 0}


def _popularity_raw(signal: ProductSignal, interactions: int) -> float:
    rating_part = (signal.rating / 5.0) * math.log1p(signal.review_count)
    return rating_part + POPULARITY_INTERACTION_BONUS * math.log1p(interactions)


class RecommendationModel:
    def __init__(
        self,
        products: list[ProductSignal],
        interactions: list[Interaction],
        now: datetime,
        min_active_users: int,
    ):
        self._products = {product.product_id: product for product in products}
        self._vectors = tfidf_vectors({product.product_id: product.text for product in products})
        self._min_active_users = min_active_users

        self._profiles: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        self._events_by_user: dict[str, dict[str, set[int]]] = defaultdict(lambda: defaultdict(set))
        interaction_counts: Counter[int] = Counter()
        recency_raw: dict[int, float] = defaultdict(float)

        for interaction in interactions:
            weight = EVENT_WEIGHTS.get(interaction.event_type, 0.0)
            self._events_by_user[interaction.user_key][interaction.event_type].add(interaction.product_id)
            self._profiles[interaction.user_key][interaction.product_id] += weight
            interaction_counts[interaction.product_id] += 1
            age_days = (now - interaction.created_at).total_seconds() / 86400.0
            if weight > 0 and 0 <= age_days <= RECENCY_WINDOW_DAYS:
                recency_raw[interaction.product_id] += weight * math.exp(-age_days / RECENCY_WINDOW_DAYS)

        self._profiles = {
            user: {pid: weight for pid, weight in profile.items() if weight > 0}
            for user, profile in self._profiles.items()
        }
        self._profiles = {user: profile for user, profile in self._profiles.items() if profile}
        self._active_users = set(self._profiles)

        self._item_users: dict[int, dict[str, float]] = defaultdict(dict)
        for user, profile in self._profiles.items():
            for product_id, weight in profile.items():
                self._item_users[product_id][user] = weight
        self._item_norms = {pid: math.sqrt(sum(w * w for w in users.values())) for pid, users in self._item_users.items()}

        self._popularity = _normalise({
            product.product_id: _popularity_raw(product, interaction_counts[product.product_id])
            for product in products
        })
        self._recency = _normalise(dict(recency_raw))

    def has_products(self) -> bool:
        return bool(self._products)

    def payload(self, product_id: int) -> dict | None:
        product = self._products.get(product_id)
        return product.payload if product else None

    def is_known(self, product_id: int) -> bool:
        return product_id in self._products

    def profile(self, user_key: str) -> dict[int, float]:
        return dict(self._profiles.get(user_key, {}))

    def interacted(self, user_key: str) -> set[int]:
        events = self._events_by_user.get(user_key, {})
        return set().union(*events.values()) if events else set()

    def co_occurring(self, product_id: int, anchor_types: tuple[str, ...], other_types: tuple[str, ...]) -> dict[int, float]:
        counts: Counter[int] = Counter()
        for events in self._events_by_user.values():
            if not any(product_id in events.get(event_type, set()) for event_type in anchor_types):
                continue
            for event_type in other_types:
                for other in events.get(event_type, set()):
                    if other != product_id:
                        counts[other] += 1
        return _normalise(dict(counts))

    def recommend(
        self,
        seed: dict[int, float],
        exclude: set[int],
        limit: int,
        weights: dict[str, float],
        content_reason: str,
        popular_reason: str,
    ) -> list[Scored]:
        components = self._components(seed)
        active = {name: weights[name] for name in components if weights.get(name, 0) > 0}
        total = sum(active.values())
        if total <= 0:
            return []

        combined: dict[int, float] = defaultdict(float)
        strongest: dict[int, tuple[float, str]] = {}
        for name, scores in components.items():
            if name not in active:
                continue
            share = active[name] / total
            for product_id, score in scores.items():
                if product_id in exclude or product_id not in self._products:
                    continue
                contribution = share * score
                combined[product_id] += contribution
                if product_id not in strongest or contribution > strongest[product_id][0]:
                    strongest[product_id] = (contribution, name)

        reasons = {
            "content": content_reason,
            "collaborative": REASON_COLLABORATIVE,
            "popularity": popular_reason,
            "recency": REASON_TRENDING,
        }
        ranked = sorted(combined.items(), key=lambda item: (-item[1], item[0]))[:limit]
        return [
            Scored(product_id, round(min(score, 1.0), 4), reasons[strongest[product_id][1]])
            for product_id, score in ranked
            if score > 0
        ]

    def _components(self, seed: dict[int, float]) -> dict[str, dict[int, float]]:
        components: dict[str, dict[int, float]] = {}
        content = self._content_scores(seed)
        if content:
            components["content"] = content
        if seed and len(self._active_users) >= self._min_active_users:
            collaborative = self._collaborative_scores(seed)
            if collaborative:
                components["collaborative"] = collaborative
        components["popularity"] = self._popularity
        components["recency"] = self._recency
        return components

    def _content_scores(self, seed: dict[int, float]) -> dict[int, float]:
        profile: dict[str, float] = defaultdict(float)
        for product_id, weight in seed.items():
            for term, value in self._vectors.get(product_id, {}).items():
                profile[term] += weight * value
        unit = _unit(dict(profile))
        if not unit:
            return {}
        scores = {product_id: cosine(unit, vector) for product_id, vector in self._vectors.items()}
        return _normalise(scores)

    def _collaborative_scores(self, seed: dict[int, float]) -> dict[int, float]:
        scores: dict[int, float] = defaultdict(float)
        for anchor, anchor_weight in seed.items():
            anchor_users = self._item_users.get(anchor)
            anchor_norm = self._item_norms.get(anchor, 0.0)
            if not anchor_users or anchor_norm == 0:
                continue
            for candidate, candidate_users in self._item_users.items():
                candidate_norm = self._item_norms.get(candidate, 0.0)
                if candidate == anchor or candidate_norm == 0:
                    continue
                shared = sum(weight * candidate_users.get(user, 0.0) for user, weight in anchor_users.items())
                scores[candidate] += anchor_weight * shared / (anchor_norm * candidate_norm)
        return _normalise(dict(scores))
