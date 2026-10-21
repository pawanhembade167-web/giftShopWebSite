import requests, csv, time

BASE = "https://archiesonline.com"
TARGET = 2000

COLLECTIONS = {
    "all":       f"{BASE}/products.json",
    "flowers":   f"{BASE}/collections/flowers/products.json",
    "chocolates":f"{BASE}/collections/chocolate-bouquets/products.json",
    "flowers_chocolates": f"{BASE}/collections/flowers-with-chocolates/products.json",
}

def fetch_collection(base_url, target=500):
    """Fetch products from a single collection endpoint."""
    products = []
    page = 1
    while len(products) < target:
        url = f"{base_url}?limit=250&page={page}"
        resp = requests.get(url, timeout=30)
        batch = resp.json().get("products", [])
        if not batch:
            break
        products.extend(batch)
        print(f"  Page {page}: got {len(batch)} (total: {len(products)})")
        page += 1
        time.sleep(1)
    return products[:target]

# --- Fetch each collection ---
all_products = fetch_collection(COLLECTIONS["all"], TARGET)

flower_products = fetch_collection(COLLECTIONS["flowers"], 200)
chocolate_products = fetch_collection(COLLECTIONS["chocolates"], 200)
combo_products = fetch_collection(COLLECTIONS["flowers_chocolates"], 100)

# --- Deduplicate & tag ---
seen_ids = set()
rows = []

def add_product(p, category):
    pid = p.get("id")
    if pid in seen_ids:
        return
    seen_ids.add(pid)
    images = p.get("images", [])
    rows.append({
        "id": pid,
        "title": p.get("title", ""),
        "handle": p.get("handle", ""),
        "description": (p.get("description", "")[:500]).replace("\n", " "),
        "price": p["variants"][0]["price"] if p.get("variants") else "",
        "compare_at_price": p["variants"][0].get("compare_at_price", "") if p.get("variants") else "",
        "image_1": images[0]["src"] if len(images) > 0 else "",
        "image_2": images[1]["src"] if len(images) > 1 else "",
        "image_3": images[2]["src"] if len(images) > 2 else "",
        "image_4": images[3]["src"] if len(images) > 3 else "",
        "all_images": "|".join(img["src"] for img in images),
        "vendor": p.get("vendor", ""),
        "tags": "|".join(p.get("tags", [])),
        "available": p.get("available", ""),
        "product_type": p.get("product_type", ""),
        "category": category,
    })

for p in flower_products:
    add_product(p, "flowers")
for p in chocolate_products:
    add_product(p, "chocolates")
for p in combo_products:
    add_product(p, "flowers+chocolates")
for p in all_products:
    add_product(p, "general")

# --- Write CSV ---
with open("archies_gifts_with_ch_2000.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "id", "title", "handle", "description", "price",
        "compare_at_price", "image_1", "image_2", "image_3", "image_4",
        "all_images", "vendor", "tags", "available", "product_type", "category"
    ])
    writer.writeheader()
    writer.writerows(rows[:TARGET])

print(f"\n✅ Done! Wrote {len(rows[:TARGET])} products to archies_gifts_with_ch_2000.csv")
print(f"   Flowers: {sum(1 for r in rows if r['category']=='flowers')}")
print(f"   Chocolates: {sum(1 for r in rows if r['category']=='chocolates')}")
print(f"   Flowers+Chocolates: {sum(1 for r in rows if r['category']=='flowers+chocolates')}")
print(f"   General: {sum(1 for r in rows if r['category']=='general')}")   