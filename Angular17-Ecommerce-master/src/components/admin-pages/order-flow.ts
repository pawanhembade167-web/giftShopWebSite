/** Statuses an order can move to next. Mirrors the rules enforced by the API. */
const NEXT_STATUSES: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const ORDER_STATUS_FILTERS = [
  'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED',
];

export function allowedNextStatuses(status: string): string[] {
  return NEXT_STATUSES[status] ?? [];
}

export function canMarkCashPaid(order: { paymentMethod: string; paymentStatus: string; status: string }): boolean {
  return order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING' && order.status === 'DELIVERED';
}
