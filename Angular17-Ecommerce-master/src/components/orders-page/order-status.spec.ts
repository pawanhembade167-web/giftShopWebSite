import { isCancellable, orderStatusLabel, timelineSteps } from './order-status';

describe('timelineSteps', () => {
  it('marks only the steps already reached for an active order', () => {
    const steps = timelineSteps(['PLACED', 'CONFIRMED']);

    expect(steps.map((step) => step.done)).toEqual([true, true, false, false, false, false]);
  });

  it('shows where a cancelled order stopped, followed by the cancellation', () => {
    const steps = timelineSteps(['PLACED', 'CANCELLED']);

    expect(steps.map((step) => step.status)).toEqual(['PLACED', 'CANCELLED']);
    expect(steps.every((step) => step.done)).toBeTrue();
  });

  it('labels statuses in plain English', () => {
    expect(orderStatusLabel('OUT_FOR_DELIVERY')).toBe('Out for delivery');
  });
});

describe('isCancellable', () => {
  it('allows cancellation only before the order ships', () => {
    expect(isCancellable('PLACED')).toBeTrue();
    expect(isCancellable('CONFIRMED')).toBeTrue();
    expect(isCancellable('SHIPPED')).toBeFalse();
    expect(isCancellable('CANCELLED')).toBeFalse();
  });
});
