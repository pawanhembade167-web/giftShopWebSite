export const ORDER_STATUS_FLOW = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

const LABELS: Record<string, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export function orderStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function isCancellable(status: string): boolean {
  return status === 'PLACED' || status === 'CONFIRMED';
}

/**
 * The steps to show on the order timeline. A cancelled order shows where it stopped, then the
 * cancellation; an active order shows every step, with the ones reached so far marked done.
 */
export function timelineSteps(reached: string[]): { status: string; label: string; done: boolean }[] {
  const lastReached = reached[reached.length - 1];
  if (lastReached === 'CANCELLED' || lastReached === 'RETURNED') {
    return [
      ...ORDER_STATUS_FLOW.filter((status) => reached.includes(status)).map((status) => ({
        status,
        label: orderStatusLabel(status),
        done: true,
      })),
      { status: lastReached, label: orderStatusLabel(lastReached), done: true },
    ];
  }
  return ORDER_STATUS_FLOW.map((status) => ({
    status,
    label: orderStatusLabel(status),
    done: reached.includes(status),
  }));
}
