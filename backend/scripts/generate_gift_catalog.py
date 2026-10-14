"""Generates a SAMPLE gift catalog for development and demos.

Products, brands and prices are invented. Replace this with supplier data before launch.
Prices are written in rupees, so import with --currency inr.
"""

import argparse
import csv
import random
from html import escape
from pathlib import Path

HEADER = ["ID", "PID", "Rating", "ReviewCount", "Category", "Brand", "Name", "Price", "ImgURL", "Desc", "Tags"]
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "gift_catalog_sample.csv"
DEFAULT_IMAGE_DIR = Path(__file__).resolve().parents[2] / "Angular17-Ecommerce-master" / "src" / "assets" / "products"
TOP_LEVEL_COLOURS = {"Occasions": "#b5162b", "Recipients": "#2b7a78", "Home and Decor": "#b7791f"}

# category path -> (product type, price range in rupees, name nouns)
CATALOG: dict[str, list[tuple[str, tuple[int, int], list[str]]]] = {
    "Occasions > Birthday": [
        ("Gift Hampers", (799, 3499), ["Celebration Hamper", "Sweet Surprise Box", "Birthday Treat Basket"]),
        ("Personalised Gifts", (499, 2499), ["Name Mug", "Photo Keychain", "Custom Cushion"]),
        ("Cards and Balloons", (99, 599), ["Greeting Card Set", "Balloon Bouquet", "Party Banner"]),
    ],
    "Occasions > Anniversary": [
        ("Couple Gifts", (999, 4999), ["Couple Mug Set", "Love Frame", "Twin Watch Set"]),
        ("Flowers", (499, 1999), ["Rose Bouquet", "Orchid Arrangement", "Seasonal Flower Box"]),
        ("Jewellery", (699, 5999), ["Heart Pendant", "Silver Band", "Charm Bracelet"]),
    ],
    "Occasions > Wedding": [
        ("Return Gifts", (149, 499), ["Mini Candle Set", "Favour Box", "Potted Plant"]),
        ("Gift Sets", (1499, 7999), ["Dinner Set", "Bedding Gift Set", "Serving Tray Set"]),
    ],
    "Occasions > Diwali": [
        ("Sweets and Dry Fruits", (399, 1999), ["Dry Fruit Box", "Sweet Assortment", "Mithai Tin"]),
        ("Diyas and Decor", (199, 1299), ["Clay Diya Set", "LED Lantern", "Rangoli Kit"]),
    ],
    "Occasions > Rakhi": [
        ("Rakhis", (149, 799), ["Designer Rakhi", "Kids Rakhi Set", "Rakhi and Chocolate Pack"]),
        ("Chocolates", (199, 999), ["Chocolate Box", "Truffle Assortment", "Milk Chocolate Tin"]),
    ],
    "Recipients > For Her": [
        ("Bags and Accessories", (499, 2999), ["Tote Bag", "Sling Bag", "Silk Scarf"]),
        ("Beauty and Wellness", (299, 1999), ["Skin Care Set", "Bath Gift Box", "Aroma Candle Trio"]),
        ("Jewellery", (499, 4999), ["Stud Earrings", "Pearl Necklace", "Bangle Set"]),
    ],
    "Recipients > For Him": [
        ("Watches", (999, 6999), ["Analog Watch", "Chrono Watch", "Leather Strap Watch"]),
        ("Grooming Kits", (499, 2499), ["Shave Kit", "Beard Care Set", "Fragrance Duo"]),
        ("Wallets", (399, 1899), ["Bifold Wallet", "Card Holder", "Travel Wallet"]),
    ],
    "Recipients > Kids": [
        ("Toys", (299, 2499), ["Building Blocks", "Plush Toy", "Puzzle Set"]),
        ("Books and Stationery", (149, 899), ["Storybook Set", "Art Kit", "Activity Journal"]),
    ],
    "Home and Decor > Decor": [
        ("Candles", (249, 1299), ["Scented Candle", "Soy Candle Trio", "Pillar Candle"]),
        ("Photo Frames", (199, 1499), ["Wooden Photo Frame", "Collage Frame", "Desk Frame"]),
        ("Showpieces", (299, 2999), ["Brass Figurine", "Ceramic Vase", "Wall Art Piece"]),
    ],
}

ADJECTIVES = ["Classic", "Premium", "Rustic", "Modern", "Cosy", "Elegant", "Playful", "Essential"]
BRANDS = ["Lumi and Co", "Rosewood Studio", "Maple Gifting", "Bloom House", "Velvet Lane", "Tanvi Crafts", "Northstar Goods"]


def placeholder_svg(product_id: int, label: str, colour: str) -> str:
    text = escape(label)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
        '<rect width="400" height="400" fill="#fbf7f4"/>'
        f'<rect x="110" y="150" width="180" height="150" rx="10" fill="{colour}"/>'
        '<rect x="110" y="120" width="180" height="40" rx="8" fill="#ffffff" opacity="0.9"/>'
        f'<rect x="185" y="120" width="30" height="180" fill="#ffffff" opacity="0.85"/>'
        f'<path d="M200 120 C170 80 140 90 160 115 M200 120 C230 80 260 90 240 115" stroke="{colour}" '
        'stroke-width="8" fill="none"/>'
        f'<text x="200" y="350" font-family="Georgia, serif" font-size="22" text-anchor="middle" fill="#222222">{text}</text>'
        f'<text x="200" y="378" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#8a8a8a">'
        f'Placeholder image #{product_id}</text>'
        "</svg>"
    )


def generate_catalog(path: Path, seed: int = 42, image_dir: Path | None = None) -> int:
    rng = random.Random(seed)
    rows: list[list[str]] = []
    product_id = 0
    for category, types in CATALOG.items():
        for product_type, (low, high), nouns in types:
            for noun in nouns:
                for variant in range(2):
                    product_id += 1
                    adjective = rng.choice(ADJECTIVES)
                    price = rng.randint(low, high) // 9 * 9 + 9 if high > 1000 else rng.randint(low, high)
                    rating = round(rng.uniform(3.5, 5.0), 1)
                    reviews = rng.randint(0, 400)
                    name = f"{adjective} {noun} {'' if variant == 0 else 'Special Edition'}".strip()
                    description = f"Sample {product_type.lower()} product for demonstrating the store. Replace with supplier details."
                    tags = " ".join(filter(None, [product_type, noun, category.split(" > ")[-1]])).lower()
                    image_url = f"assets/products/{product_id}.svg"
                    if image_dir is not None:
                        image_dir.mkdir(parents=True, exist_ok=True)
                        colour = TOP_LEVEL_COLOURS[category.split(" > ")[0]]
                        (image_dir / f"{product_id}.svg").write_text(placeholder_svg(product_id, product_type, colour), encoding="utf-8")
                    rows.append([
                        str(product_id), str(product_id), str(rating), str(reviews), f"{category} > {product_type}",
                        rng.choice(BRANDS), name, str(price), image_url, description, tags,
                    ])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        writer.writerows(rows)
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a sample gift catalog CSV (prices in rupees).")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--images", type=Path, default=DEFAULT_IMAGE_DIR)
    args = parser.parse_args()
    count = generate_catalog(args.out, seed=args.seed, image_dir=args.images)
    print(f"Wrote {count} sample gift products to {args.out}.")


if __name__ == "__main__":
    main()
