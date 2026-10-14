import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

VALIDATION_MESSAGE = "Please correct the highlighted fields."


class AppError(Exception):
    def __init__(self, status_code: int, message: str, errors: list[dict[str, Any]] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.errors = errors or []


def error_body(message: str, errors: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {"success": False, "message": message, "errors": errors or []}


def _field_name(location: tuple) -> str:
    fields = [str(part) for part in location if part not in ("body", "query", "path", "header")]
    return fields[-1] if fields else "request"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, error: AppError) -> JSONResponse:
        return JSONResponse(status_code=error.status_code, content=error_body(error.message, error.errors))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": _field_name(tuple(item["loc"])), "message": item["msg"].removeprefix("Value error, ")}
            for item in error.errors()
        ]
        return JSONResponse(status_code=422, content=error_body(VALIDATION_MESSAGE, errors))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, error: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=error)
        return JSONResponse(status_code=500, content=error_body("Something went wrong. Please try again."))
