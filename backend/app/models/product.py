from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_price", "price"), Index("ix_products_brand", "brand"))

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    subcategory: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    product_type: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    price: Mapped[float] = mapped_column(Float)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str] = mapped_column(Text, default="")
    stock: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
