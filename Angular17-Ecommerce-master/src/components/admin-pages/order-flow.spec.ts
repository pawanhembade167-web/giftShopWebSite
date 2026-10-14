import { allowedNextStatuses, canMarkCashPaid } from './order-flow';

describe('allowedNextStatuses', () => {
  it('lets a placed order be confirmed or cancelled but not skip ahead', () => {
    expect(allowedNextStatuses('PLACED')).toEqual(['CONFIRMED', 'CANCELLED']);
  });

  it('offers no moves for a cancelled or returned order', () => {
    expect(allowedNextStatuses('CANCELLED')).toEqual([]);
    expect(allowedNextStatuses('RETURNED')).toEqual([]);
  });
});

describe('canMarkCashPaid', () => {
  it('is true only for a delivered cash on delivery order that is still pending', () => {
    expect(canMarkCashPaid({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'DELIVERED' })).toBeTrue();
    expect(canMarkCashPaid({ paymentMethod: 'COD', paymentStatus: 'PENDING', status: 'SHIPPED' })).toBeFalse();
    expect(canMarkCashPaid({ paymentMethod: 'MOCK_CARD', paymentStatus: 'PAID', status: 'DELIVERED' })).toBeFalse();
  });
});
