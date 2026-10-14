import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';

import { CartStore, describeSkipped } from './cart-store.service';
import { GuestCart } from './guest-cart.service';
import { UserAuthenService } from './user-auth.service';
import { ToastService } from './toast.service';
import { environment } from '../environments/environment';
import IProduct from '../models/IProduct';

describe('CartStore', () => {
  const product: IProduct = { id: 3, Name: 'Argan Shampoo', Quantity: 4, Price: 120, Factory: 'Pantene' };
  const productDto = {
    id: 3, name: 'Argan Shampoo', brand: 'Pantene', categoryId: null, price: 120, rating: 4,
    reviewCount: 5, imageUrl: null, description: null, stock: 4,
  };

  let http: HttpTestingController;
  let guest: GuestCart;
  let loggedIn: BehaviorSubject<boolean>;

  beforeEach(() => {
    localStorage.clear();
    loggedIn = new BehaviorSubject<boolean>(false);
    const auth = jasmine.createSpyObj<UserAuthenService>('UserAuthenService', ['getUserLoggedStatus'], { isUserLogged: false });
    auth.getUserLoggedStatus.and.returnValue(loggedIn.asObservable());

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: UserAuthenService, useValue: auth }],
    });
    http = TestBed.inject(HttpTestingController);
    guest = TestBed.inject(GuestCart);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('refuses a guest add when the product is out of stock', () => {
    const store = TestBed.inject(CartStore);
    let error: Error | undefined;

    store.add({ ...product, Quantity: 0 }).subscribe({ error: (e) => (error = e) });

    expect(error?.message).toBe('This item is out of stock.');
    expect(guest.read()).toEqual([]);
  });

  it('refuses a guest add that would exceed the stock already available', () => {
    const store = TestBed.inject(CartStore);
    guest.add(3, 3);
    let error: Error | undefined;

    store.add(product, 2).subscribe({ error: (e) => (error = e) });

    expect(error?.message).toBe('Only 4 left in stock.');
  });

  it('keeps a guest add in local storage and loads the product for the cart lines', () => {
    const store = TestBed.inject(CartStore);

    store.add(product, 2).subscribe();
    http.expectOne(`${environment.apiBaseUrl}/api/events`).flush({});
    http.expectOne(`${environment.apiBaseUrl}/api/products/3`).flush({ success: true, message: '', data: { product: productDto } });

    expect(guest.read()).toEqual([{ productId: 3, quantity: 2 }]);
    expect(store.lines()[0].lineTotal).toBe(240);
    expect(store.totals().subtotal).toBe(240);
  });

  it('merges the guest cart into the account when the shopper signs in', () => {
    const store = TestBed.inject(CartStore);
    guest.add(3, 2);

    loggedIn.next(true);

    const merge = http.expectOne(`${environment.apiBaseUrl}/api/cart/merge`);
    expect(merge.request.body).toEqual({ items: [{ productId: 3, quantity: 2 }] });
    merge.flush({
      success: true,
      message: '',
      data: {
        cart: { items: [], subtotal: 0, shipping: 0, tax: 0, total: 0, itemCount: 0 },
        skipped: [{ productId: 9, reason: 'out-of-stock' }],
      },
    });

    expect(guest.read()).toEqual([]);
    const toast = TestBed.inject(ToastService);
    expect(toast.toasts()[0].message).toBe('1 item was not added because stock changed.');
    expect(toast.toasts()[0].type).toBe('warning');
  });

  it('describes skipped items only when there are some', () => {
    expect(describeSkipped([])).toBeNull();
    expect(describeSkipped([{ productId: 1, reason: 'limited' }, { productId: 2, reason: 'limited' }]))
      .toBe('2 items were not added because stock changed.');
  });

  it('refuses to move items to the wishlist for guests', () => {
    const store = TestBed.inject(CartStore);
    let error: Error | undefined;

    store.moveToWishlist(3).subscribe({ error: (e) => (error = e) });

    expect(error?.message).toBe('Sign in to save items to your wishlist.');
  });
});
