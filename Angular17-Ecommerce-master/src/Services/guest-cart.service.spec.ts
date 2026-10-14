import { TestBed } from '@angular/core/testing';

import { GuestCart, GUEST_CART_MAX_LINE } from './guest-cart.service';

describe('GuestCart', () => {
  let cart: GuestCart;

  beforeEach(() => {
    localStorage.clear();
    cart = TestBed.inject(GuestCart);
  });

  afterEach(() => localStorage.clear());

  it('adds a product and keeps quantities for the same product together', () => {
    cart.add(7, 1);
    cart.add(7, 2);

    expect(cart.read()).toEqual([{ productId: 7, quantity: 3 }]);
  });

  it('caps a single line at the maximum quantity', () => {
    cart.add(7, GUEST_CART_MAX_LINE + 5);

    expect(cart.read()[0].quantity).toBe(GUEST_CART_MAX_LINE);
  });

  it('removes a line when its quantity is set to zero', () => {
    cart.add(7, 2);

    cart.setQuantity(7, 0);

    expect(cart.read()).toEqual([]);
  });

  it('returns an empty list when stored data is corrupted', () => {
    localStorage.setItem('echomart.guestCart', '{broken');

    expect(cart.read()).toEqual([]);
  });

  it('ignores stored entries that are not valid cart lines', () => {
    localStorage.setItem('echomart.guestCart', JSON.stringify([{ productId: 1, quantity: 2 }, { nope: true }]));

    expect(cart.read()).toEqual([{ productId: 1, quantity: 2 }]);
  });
});
