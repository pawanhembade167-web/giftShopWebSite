from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.repositories.product_repository import ProductRepository
from app.routes.auth import get_db_session
from app.schemas.catalog import ProductOut

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/suggestions")
def suggestions(q: str = Query(default="", max_length=60), session: Session = Depends(get_db_session)) -> dict:
    found = ProductRepository(session).suggest(q)
    data = {
        "products": [ProductOut.model_validate(p).model_dump(by_alias=True) for p in found["products"]],
        "categories": [{"id": c.id, "name": c.name} for c in found["categories"]],
        "subcategories": [{"name": s["name"], "categoryId": s["categoryId"]} for s in found["subcategories"]],
    }
    return {"success": True, "data": data, "message": "Suggestions fetched."}
