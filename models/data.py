import requests, csv, time

BASE = "https://archiesonline.com/products.json"
TARGET = 2000

all_products = []
page = 1

while len(all_products) < TARGET:
    url = f"{BASE}?limit=250&page={page}"
    resp = requests.get(url, timeout=30)
    products = resp.json().get("products", [])
    if not products:
        break
    all_products.extend(products)
    print(f"Page {page}: got {len(products)} (total: {len(all_products)})")
    page += 1
    time.sleep(1)

all_products = all_products[:TARGET]

with open("archies_gifts_2000.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "id", "title", "handle", "description", "price",
        "compare_at_price", "image_url", "image_url_2",
        "vendor", "tags", "available", "type"
    ])
    for p in all_products:
        images = p.get("images", [])
        writer.writerow([
            p.get("id", ""),
            p.get("title", ""),
            p.get("handle", ""),
            p.get("description", "")[:500].replace("\n", " "),
            p["variants"][0]["price"] if p.get("variants") else "",
            p["variants"][0].get("compare_at_price", "") if p.get("variants") else "",
            images[0]["src"] if len(images) > 0 else "",
            images[1]["src"] if len(images) > 1 else "",
            p.get("vendor", ""),
            "|".join(p.get("tags", [])),
            p.get("available", ""),
            p.get("product_type", "")
        ])

print(f"\n✅ Done! Wrote {len(all_products)} products to archies_gifts_2000.csv")   