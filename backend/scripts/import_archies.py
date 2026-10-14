"""Imports the Archies products (with their images) from a Shopify export.

Only products from the Archies vendor are imported. Images are linked from the Shopify CDN, not copied.
Usage (from the backend folder):
    python -m scripts.import_archies ../models/archies_gifts_500.csv
"""

import argparse
from pathlib import Path

from app.config.database import create_session_factory
from app.config.settings import get_settings
from sqlalchemy import select

from app.models.product import Product
from app.services.product_import import import_products, read_shopify_products

VENDOR = "Archies"


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Archies products from a Shopify CSV export.")
    parser.add_argument("csv", type=Path)
    args = parser.parse_args()
    session_factory = create_session_factory(get_settings().database_url)
    with session_factory() as session:
        inserted = import_products(
            session, read_shopify_products(args.csv, vendor=VENDOR), limit=10_000, seed=0, usd_to_inr=1.0
        )
        filled = 0
        for row in read_shopify_products(args.csv, vendor=VENDOR):
            product = session.scalar(select(Product).where(Product.source_id == row["source_id"]))
            if product is not None and not product.description:
                product.description = row["description"]
                filled += 1
        session.commit()
    print(f"Imported {inserted} {VENDOR} products. Added descriptions to {filled}.")


if __name__ == "__main__":
    main()
