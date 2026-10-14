import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import IProduct from '../models/IProduct';
import { CommerceApi, WishlistDto } from './commerce-api.service';
import { toProduct } from './catalog-api.service';
import { CartStore } from './cart-store.service';
import { UserAuthenService } from './user-auth.service';

/** Saved-for-later items. Signed-in only: the list lives on the account. */
@Injectable({
  providedIn: 'root'
})
export class WishlistStore {
  private readonly commerce = inject(CommerceApi);
  private readonly auth = inject(UserAuthenService);
  private readonly cart = inject(CartStore);

  readonly items = signal<IProduct[]>([]);
  readonly count = computed(() => this.items().length);
  readonly savedIds = computed(() => new Set(this.items().map((product) => product.id)));

  constructor() {
    this.auth.getUserLoggedStatus().subscribe((loggedIn) => {
      if (loggedIn) {
        this.refresh().subscribe({ error: () => undefined });
      } else {
        this.items.set([]);
      }
    });
  }

  isSaved(productId: number): boolean {
    return this.savedIds().has(productId);
  }

  refresh(): Observable<void> {
    return this.commerce.getWishlist().pipe(tap((wishlist) => this.apply(wishlist)), map(() => undefined));
  }

  add(product: IProduct): Observable<void> {
    return this.commerce.addToWishlist(product.id).pipe(tap((wishlist) => this.apply(wishlist)), map(() => undefined));
  }

  remove(productId: number): Observable<void> {
    return this.commerce.removeFromWishlist(productId).pipe(tap((wishlist) => this.apply(wishlist)), map(() => undefined));
  }

  moveToCart(productId: number): Observable<void> {
    return this.commerce.moveWishlistItemToCart(productId).pipe(
      tap(({ wishlist }) => {
        this.apply(wishlist);
        this.cart.refresh().subscribe({ error: () => undefined });
      }),
      map(() => undefined)
    );
  }

  private apply(wishlist: WishlistDto): void {
    this.items.set(wishlist.items.map((item) => toProduct(item.product)));
  }
}
