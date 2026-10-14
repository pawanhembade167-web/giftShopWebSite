import IProduct from '../../models/IProduct';

export interface HamperDraftLine {
  product: IProduct;
  quantity: number;
}

export function hamperTotal(lines: HamperDraftLine[]): number {
  const total = lines.reduce((sum, line) => sum + line.product.Price * line.quantity, 0);
  return Math.round(total * 100) / 100;
}

/** Adds one of a product, never going above the stock we know about. */
export function addLine(lines: HamperDraftLine[], product: IProduct): HamperDraftLine[] {
  const existing = lines.find((line) => line.product.id === product.id);
  if (!existing) {
    return [...lines, { product, quantity: 1 }];
  }
  return lines.map((line) =>
    line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, line.product.Quantity) } : line
  );
}
