import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import IProduct from '../../models/IProduct';
import { PRODUCT_CURRENCY, PRODUCT_PLACEHOLDER_IMAGE } from '../../models/product-display.constants';
import { WishlistStore } from '../../Services/wishlist-store.service';
import { AddToCartService } from '../../Services/add-to-cart.service';
import { messageFrom } from '../../Services/error-message';

@Component({
  selector: 'app-wishlist-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist-page.component.html',
  styleUrl: './wishlist-page.component.scss'
})
export class WishlistPageComponent {
  private readonly toast = inject(ToastService);
  readonly wishlist = inject(WishlistStore);
  private readonly addToCart = inject(AddToCartService);

  readonly currency = PRODUCT_CURRENCY;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  readonly busyProductId = signal<number | null>(null);

  constructor() {
    this.wishlist.refresh().subscribe({ error: () => this.toast.error('We could not load your wishlist. Please try again.') });
  }

  moveToCart(product: IProduct): void {
    this.run(product.id, this.wishlist.moveToCart(product.id), `${product.Name} was moved to your cart.`);
  }

  remove(product: IProduct): void {
    this.run(product.id, this.wishlist.remove(product.id), `${product.Name} was removed from your wishlist.`);
  }

  private run(productId: number, action: Observable<void>, success: string): void {
    this.busyProductId.set(productId);
    action.subscribe({
      next: () => {
        this.busyProductId.set(null);
        this.toast.success(success);
      },
      error: (error) => {
        this.busyProductId.set(null);
        this.toast.error(messageFrom(error, 'We could not update your wishlist. Please try again.'));
      }
    });
  }
}
