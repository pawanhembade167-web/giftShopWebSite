FREE_SHIPPING_THRESHOLD = 500.0
SHIPPING_FEE = 49.0
TAX_RATE = 0.05


def money(value: float) -> float:
    return round(value, 2)


def compute_totals(subtotal: float) -> tuple[float, float, float]:
    shipping = 0.0 if subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
    tax = money(subtotal * TAX_RATE)
    total = money(subtotal + shipping + tax)
    return money(shipping), tax, total
