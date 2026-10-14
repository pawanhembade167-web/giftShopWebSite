import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import IProduct from '../models/IProduct';
import { CartStore } from './cart-store.service';

export type AddToCartResult = 'added' | 'login-required';

/** Kept as the single entry point the storefront pages call; the cart itself lives in CartStore. */
@Injectable({
  providedIn: 'root'
})
export class AddToCartService {
  private readonly cart = inject(CartStore);

  addProduct(product: IProduct): Observable<AddToCartResult> {
    return this.cart.add(product).pipe(map(() => 'added' as const));
  }
}
