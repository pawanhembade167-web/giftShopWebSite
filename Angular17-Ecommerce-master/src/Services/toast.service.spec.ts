import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ToastService, TOAST_LIMIT, DEFAULT_TOAST_MS, ERROR_TOAST_MS } from './toast.service';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    toast = TestBed.inject(ToastService);
  });

  it('shows a success message with its type', () => {
    toast.success('Added to your cart.');

    expect(toast.toasts().map((t) => ({ message: t.message, type: t.type }))).toEqual([
      { message: 'Added to your cart.', type: 'success' },
    ]);
  });

  it('shows error, info and warning messages with their own types', () => {
    toast.error('Something failed.');
    toast.info('For your information.');
    toast.warning('Check your cart.');

    expect(toast.toasts().map((t) => t.type)).toEqual(['error', 'info', 'warning']);
  });

  it('removes a toast after its duration', fakeAsync(() => {
    toast.success('Saved.');

    tick(DEFAULT_TOAST_MS - 1);
    expect(toast.toasts().length).toBe(1);

    tick(1);
    expect(toast.toasts().length).toBe(0);
  }));

  it('keeps errors on screen longer than other messages', fakeAsync(() => {
    toast.error('Could not save.');

    tick(DEFAULT_TOAST_MS);
    expect(toast.toasts().length).toBe(1);

    tick(ERROR_TOAST_MS - DEFAULT_TOAST_MS);
    expect(toast.toasts().length).toBe(0);
  }));

  it('dismisses a toast when asked', () => {
    const id = toast.info('Hello.');

    toast.dismiss(id);

    expect(toast.toasts()).toEqual([]);
  });

  it('keeps only the most recent messages on screen', () => {
    for (let index = 1; index <= TOAST_LIMIT + 2; index++) {
      toast.info(`Message ${index}`);
    }

    expect(toast.toasts().length).toBe(TOAST_LIMIT);
    expect(toast.toasts()[TOAST_LIMIT - 1].message).toBe(`Message ${TOAST_LIMIT + 2}`);
  });
});
