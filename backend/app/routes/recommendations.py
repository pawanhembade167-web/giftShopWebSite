from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.config.settings import Settings
from app.models.user import User
from app.routes.auth import get_current_user, get_db_session, get_optional_user, get_settings
from app.services.recommendation_service import ModelCache, Recommendations, RecommendationService
from app.repositories.event_repository import user_key_for

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])
DEFAULT_LIMIT = 8
MAX_LIMIT = 24


def get_recommendation_service(
    request: Request,
    session: Session = Depends(get_db_session),
    settings: Settings = Depends(get_settings),
) -> RecommendationService:
    cache: ModelCache = request.app.state.recommendation_cache
    return RecommendationService(session, settings, cache)


def _respond(service: RecommendationService, result: Recommendations, message: str) -> dict:
    return {
        "success": True,
        "data": {"strategy": result.strategy, "recommendations": service.render(result)},
        "message": message,
    }


@router.get("/home")
def home(
    anonymousId: str | None = Query(default=None, min_length=8, max_length=64),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    user: User | None = Depends(get_optional_user),
    service: RecommendationService = Depends(get_recommendation_service),
) -> dict:
    key = user_key_for(user.id if user else None, anonymousId)
    return _respond(service, service.for_home(key, limit), "Home recommendations fetched.")


@router.get("/user")
def for_current_user(
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
) -> dict:
    return _respond(service, service.for_user(user_key_for(user.id, None), limit), "Your recommendations fetched.")


@router.get("/product/{product_id}")
def for_product(
    product_id: int,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    service: RecommendationService = Depends(get_recommendation_service),
) -> dict:
    return _respond(service, service.for_product(product_id, limit), "Product recommendations fetched.")


@router.get("/similar/{product_id}")
def similar(
    product_id: int,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    service: RecommendationService = Depends(get_recommendation_service),
) -> dict:
    return _respond(service, service.similar(product_id, limit), "Similar products fetched.")


@router.get("/frequently-bought/{product_id}")
def frequently_bought(
    product_id: int,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    service: RecommendationService = Depends(get_recommendation_service),
) -> dict:
    return _respond(service, service.frequently_bought(product_id, limit), "Frequently bought products fetched.")
