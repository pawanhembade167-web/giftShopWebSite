import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { CheckoutPageComponent } from './checkout-page.component';
import { CommerceApi, AddressDto } from '../../Services/commerce-api.service';
import { CartStore } from '../../Services/cart-store.service';
import { ToastService } from '../../Services/toast.service';

describe('CheckoutPageComponent', () => {
  const address: AddressDto = {
    id: 5, fullName: 'Asha Rao', phone: '+919876543210', line1: '12 MG Road', line2: null,
    city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'IN', isDefault: true,
  };
  let api: jasmine.SpyObj<CommerceApi>;
  let cart: jasmine.SpyObj<CartStore>;

  beforeEach(() => {
    api = jasmine.createSpyObj<CommerceApi>('CommerceApi', ['listAddresses', 'createAddress', 'placeOrder']);
    api.listAddresses.and.returnValue(of([address]));
    cart = jasmine.createSpyObj<CartStore>('CartStore', ['refresh'], {
      lines: jasmine.createSpy().and.returnValue([]),
      totals: jasmine.createSpy().and.returnValue({ subtotal: 0, shipping: null, tax: null, total: null }),
      itemCount: jasmine.createSpy().and.returnValue(0),
      isEmpty: jasmine.createSpy().and.returnValue(false),
    } as never);
    cart.refresh.and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'checkout', component: CheckoutPageComponent }, { path: 'orders/:orderId', component: CheckoutPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CommerceApi, useValue: api },
        { provide: CartStore, useValue: cart },
      ],
    });
  });

  it('pre-selects the default address and moves on to payment', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout', CheckoutPageComponent);

    expect(page.selectedAddress()?.id).toBe(5);
    page.next();
    expect(page.step()).toBe('payment');
  });

  it('will not continue from the address step without a chosen address', async () => {
    api.listAddresses.and.returnValue(of([]));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout', CheckoutPageComponent);

    page.next();

    expect(page.step()).toBe('address');
    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('Choose a delivery address to continue.');
  });

  it('does not save an address until every required field is valid', async () => {
    api.listAddresses.and.returnValue(of([]));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout', CheckoutPageComponent);
    page.addressForm.patchValue({ fullName: 'A', phone: '12', line1: 'x', city: 'B', state: 'C', postalCode: '!!' });

    page.saveAddress();

    expect(api.createAddress).not.toHaveBeenCalled();
    expect(page.addressForm.invalid).toBeTrue();
  });

  it('places the order with the chosen address and payment method, then opens the order', async () => {
    api.placeOrder.and.returnValue(of({
      id: 42, status: 'PLACED', paymentStatus: 'PENDING', total: 154, itemCount: 1, createdAt: '2026-10-13T10:00:00Z',
      paymentMethod: 'COD', subtotal: 100, shipping: 49, tax: 5, address: {} as never, items: [], timeline: [],
    }));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout', CheckoutPageComponent);
    page.paymentMethod.set('COD');
    page.step.set('review');

    page.placeOrder();

    expect(api.placeOrder).toHaveBeenCalledWith(5, 'COD');
  });

  it('shows the server message when the order cannot be placed', async () => {
    api.placeOrder.and.returnValue(throwError(() => ({ error: { message: 'Only 1 left in stock.' } })));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/checkout', CheckoutPageComponent);
    page.step.set('review');

    page.placeOrder();

    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('Only 1 left in stock.');
    expect(page.placing()).toBeFalse();
  });
});
