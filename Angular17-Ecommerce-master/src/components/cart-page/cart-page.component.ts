import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartLine } from '../../Services/commerce-api.service';
import { CartStore } from '../../Services/cart-store.service';
import { WishlistStore } from '../../Services/wishlist-store.service';
import { UserAuthenService } from '../../Services/user-auth.service';
import { messageFrom } from '../../Services/error-message';
import { GUEST_CART_MAX_LINE } from '../../Services/guest-cart.service';
import { PRODUCT_CURRENCY, PRODUCT_PLACEHOLDER_IMAGE } from '../../models/product-display.constants';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.scss'
})
export class CartPageComponent {
  private readonly toast = inject(ToastService);
  readonly cart = inject(CartStore);
  readonly wishlist = inject(WishlistStore);
  private readonly auth = inject(UserAuthenService);
  private readonly router = inject(Router);

  readonly signedIn = toSignal(this.auth.getUserLoggedStatus(), { initialValue: this.auth.isUserLogged });
  readonly currency = PRODUCT_CURRENCY;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  readonly busyProductId = signal<number | null>(null);

  constructor() {
    this.cart.refresh().subscribe({ error: () => this.toast.error('We could not load your cart. Please try again.') });
  }

  maxQuantity(line: CartLine): number {
    return Math.min(line.stock, GUEST_CART_MAX_LINE);
  }

  increase(line: CartLine): void {
    if (line.quantity < this.maxQuantity(line)) {
      this.change(line, line.quantity + 1);
    }
  }

  decrease(line: CartLine): void {
    if (line.quantity > 1) {
      this.change(line, line.quantity - 1);
    }
  }

  remove(line: CartLine): void {
    this.run(line.productId, this.cart.remove(line.productId), `${line.name} was removed from your cart.`);
  }

  saveForLater(line: CartLine): void {
    this.run(line.productId, this.cart.moveToWishlist(line.productId), `${line.name} was saved to your wishlist.`);
  }

  checkout(): void {
    if (this.signedIn()) {
      this.router.navigate(['/checkout']);
      return;
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
  }

  private change(line: CartLine, quantity: number): void {
    this.run(line.productId, this.cart.setQuantity(line.productId, quantity));
  }

  private run(productId: number, action: Observable<void>, success?: string): void {
    this.busyProductId.set(productId);
    action.subscribe({
      next: () => {
        this.busyProductId.set(null);
        if (success) {
          this.toast.success(success);
        }
      },
      error: (error) => {
        this.busyProductId.set(null);
        this.toast.error(messageFrom(error, 'We could not update your cart. Please try again.'));
      }
    });
  }
}
