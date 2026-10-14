import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.database import create_session_factory
from app.config.settings import Settings, get_settings
from app.routes.admin import router as admin_router
from app.routes.hampers import admin_router as hamper_admin_router, router as hamper_router
from app.routes.auth import router as auth_router
from app.routes.catalog import router as catalog_router
from app.routes.commerce import address_router, cart_router, order_router, wishlist_router
from app.routes.events import router as events_router
from app.routes.recommendations import router as recommendations_router
from app.routes.search import router as search_router
from app.services.recommendation_service import ModelCache
from app.utils.errors import register_exception_handlers


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=logging.INFO)

    app = FastAPI(title="E-Gift Shopping API", version="0.1.0")
    app.state.settings = settings
    app.state.session_factory = create_session_factory(settings.database_url)
    app.state.recommendation_cache = ModelCache()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_exception_handlers(app)
    app.include_router(auth_router)
    app.include_router(catalog_router)
    app.include_router(events_router)
    app.include_router(cart_router)
    app.include_router(wishlist_router)
    app.include_router(address_router)
    app.include_router(order_router)
    app.include_router(recommendations_router)
    app.include_router(search_router)
    app.include_router(admin_router)
    app.include_router(hamper_router)
    app.include_router(hamper_admin_router)

    @app.get("/api/health")
    def health() -> dict:
        return {"success": True, "data": {"status": "ok"}, "message": "Service is healthy."}

    return app
