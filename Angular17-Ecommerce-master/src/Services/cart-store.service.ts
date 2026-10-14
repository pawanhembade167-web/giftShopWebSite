import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import IProduct from '../models/IProduct';
import { CartDto, CartLine, CommerceApi, SkippedLine, toCartLine } from './commerce-api.service';
import { CatalogApiService } from './catalog-api.service';
import { GuestCart } from './guest-cart.service';
import { UserAuthenService } from './user-auth.service';
import { EventTracker } from './event-tracker.service';
import { ToastService } from './toast.service';

export interface CartTotals {
  subtotal: number;
  shipping: number | null;
  tax: number | null;
  total: number | null;
}

const EMPTY_TOTALS: CartTotals = { subtotal: 0, shipping: null, tax: null, total: null };

/**
 * One cart for the shopper. Signed-in shoppers use the server cart; guests use a local list.
 * On sign-in the guest list is merged into the account, so nothing added before login is lost.
 */
@Injectable({
  providedIn: 'root'
})
export class CartStore {
  private readonly commerce = inject(CommerceApi);
  private readonly catalog = inject(CatalogApiService);
  private readonly guest = inject(GuestCart);
  private readonly auth = inject(UserAuthenService);
  private readonly tracker = inject(EventTracker);
  private readonly toast = inject(ToastService);

  readonly lines = signal<CartLine[]>([]);
  readonly totals = signal<CartTotals>(EMPTY_TOTALS);
  readonly itemCount = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly isEmpty = computed(() => this.lines().length === 0);

  private loggedIn = false;

  constructor() {
    this.auth.getUserLoggedStatus().subscribe((loggedIn) => this.onAuthChange(loggedIn));
  }

  refresh(): Observable<void> {
    return this.loggedIn ? this.refreshServer() : this.refreshGuest();
  }

  add(product: IProduct, quantity = 1): Observable<void> {
    if (this.loggedIn) {
      return this.commerce.addToCart(product.id, quantity).pipe(tap((cart) => this.applyServer(cart)), map(() => undefined));
    }
    if (product.Quantity <= 0) {
      return throwError(() => new Error('This item is out of stock.'));
    }
    const alreadyInCart = this.guest.read().find((entry) => entry.productId === product.id)?.quantity ?? 0;
    if (alreadyInCart + quantity > product.Quantity) {
      return throwError(() => new Error(`Only ${product.Quantity} left in stock.`));
    }
    this.guest.add(product.id, quantity);
    this.tracker.track({ eventType: 'ADD_TO_CART', productId: product.id }).subscribe();
    return this.refreshGuest();
  }

  setQuantity(productId: number, quantity: number): Observable<void> {
    if (this.loggedIn) {
      return this.commerce.setCartQuantity(productId, quantity).pipe(tap((cart) => this.applyServer(cart)), map(() => undefined));
    }
    this.guest.setQuantity(productId, quantity);
    return this.refreshGuest();
  }

  remove(productId: number): Observable<void> {
    if (this.loggedIn) {
      return this.commerce.removeFromCart(productId).pipe(tap((cart) => this.applyServer(cart)), map(() => undefined));
    }
    this.guest.remove(productId);
    return this.refreshGuest();
  }

  moveToWishlist(productId: number): Observable<void> {
    if (!this.loggedIn) {
      return throwError(() => new Error('Sign in to save items to your wishlist.'));
    }
    return this.commerce.addToWishlist(productId).pipe(
      switchMap(() => this.commerce.removeFromCart(productId)),
      tap((cart) => this.applyServer(cart)),
      map(() => undefined)
    );
  }

  mergeGuestCart(): Observable<void> {
    const entries = this.guest.read();
    return this.commerce.mergeCart(entries).pipe(
      tap(({ cart, skipped }) => {
        this.guest.clear();
        this.applyServer(cart);
        const notice = describeSkipped(skipped);
        if (notice) {
          this.toast.warning(notice);
        }
      }),
      map(() => undefined)
    );
  }

  private onAuthChange(loggedIn: boolean): void {
    const wasLoggedIn = this.loggedIn;
    this.loggedIn = loggedIn;
    if (loggedIn) {
      this.mergeGuestCart().subscribe({ error: () => this.refreshServer().subscribe({ error: () => undefined }) });
      return;
    }
    if (wasLoggedIn) {
      this.lines.set([]);
      this.totals.set(EMPTY_TOTALS);
    }
    this.refreshGuest().subscribe({ error: () => undefined });
  }

  private refreshServer(): Observable<void> {
    return this.commerce.getCart().pipe(tap((cart) => this.applyServer(cart)), map(() => undefined));
  }

  private refreshGuest(): Observable<void> {
    const entries = this.guest.read();
    if (entries.length === 0) {
      this.lines.set([]);
      this.totals.set(EMPTY_TOTALS);
      return of(undefined);
    }
    return forkJoin(entries.map((entry) =>
      this.catalog.getProduct(entry.productId).pipe(
        map((product) => ({ product, quantity: entry.quantity })),
        catchError(() => of(null))
      )
    )).pipe(
      tap((results) => {
        const lines = results
          .filter((result): result is { product: IProduct; quantity: number } => result !== null)
          .map(({ product, quantity }) => ({
            productId: product.id,
            name: product.Name,
            unitPrice: product.Price,
            quantity,
            lineTotal: Math.round(product.Price * quantity * 100) / 100,
            stock: product.Quantity,
            product,
          }));
        this.lines.set(lines);
        const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
        this.totals.set({ subtotal, shipping: null, tax: null, total: null });
      }),
      map(() => undefined)
    );
  }

  private applyServer(cart: CartDto): void {
    this.lines.set(cart.items.map(toCartLine));
    this.totals.set({ subtotal: cart.subtotal, shipping: cart.shipping, tax: cart.tax, total: cart.total });
  }
}

export function describeSkipped(skipped: SkippedLine[]): string | null {
  if (skipped.length === 0) {
    return null;
  }
  return `${skipped.length} item${skipped.length === 1 ? ' was' : 's were'} not added because stock changed.`;
}
