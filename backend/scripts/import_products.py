import argparse
import random
from pathlib import Path

from app.config.database import create_session_factory
from app.config.settings import get_settings
from app.services.product_import import import_products, read_products_csv

DEFAULT_CSV = Path(__file__).resolve().parents[2] / "models" / "final_data.csv"


def conversion_rate(currency: str, usd_to_inr: float) -> float:
    return 1.0 if currency == "inr" else usd_to_inr


def sample_rows(rows: list[dict], seed: int) -> list[dict]:
    shuffled = rows[:]
    random.Random(seed).shuffle(shuffled)
    return shuffled


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the product catalog from a CSV file.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--limit", type=int, default=500, help="Number of products to add to the catalog.")
    parser.add_argument("--seed", type=int, default=42, help="Seed for the sample and the generated stock levels.")
    parser.add_argument("--currency", choices=["usd", "inr"], default="usd", help="Currency of the prices in the CSV.")
    args = parser.parse_args()

    session_factory = create_session_factory(get_settings().database_url)
    rows = sample_rows(list(read_products_csv(args.csv)), args.seed)
    with session_factory() as session:
        inserted = import_products(session, rows, limit=args.limit, seed=args.seed,
                                   usd_to_inr=conversion_rate(args.currency, get_settings().usd_to_inr_rate))
    print(f"Imported {inserted} products from {args.csv}.")


if __name__ == "__main__":
    main()
