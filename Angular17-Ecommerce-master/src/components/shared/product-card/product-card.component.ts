import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WishlistStore } from '../../../Services/wishlist-store.service';
import { UserAuthenService } from '../../../Services/user-auth.service';
import { ToastService } from '../../../Services/toast.service';
import { messageFrom } from '../../../Services/error-message';
import IProduct from '../../../models/IProduct';
import { ADD_TO_CART_ENABLED, PRODUCT_CURRENCY, PRODUCT_PLACEHOLDER_IMAGE } from '../../../models/product-display.constants';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  private readonly wishlist = inject(WishlistStore);
  private readonly auth = inject(UserAuthenService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) product!: IProduct;
  @Input() addToCartEnabled = ADD_TO_CART_ENABLED;
  @Input() reason: string | null = null;
  @Output() addToCart = new EventEmitter<IProduct>();
  @Output() productClicked = new EventEmitter<IProduct>();

  readonly currency = PRODUCT_CURRENCY;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;

  get isSaved(): boolean {
    return this.wishlist.isSaved(this.product.id);
  }

  toggleWishlist(): void {
    if (!this.auth.isUserLogged) {
      this.toast.info('Sign in to save items to your wishlist.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const wasSaved = this.isSaved;
    const action = wasSaved ? this.wishlist.remove(this.product.id) : this.wishlist.add(this.product);
    action.subscribe({
      next: () => this.toast.success(wasSaved ? `${this.product.Name} was removed from your wishlist.` : `${this.product.Name} was added to your wishlist.`),
      error: (error) => this.toast.error(messageFrom(error, 'We could not update your wishlist. Please try again.'))
    });
  }

  get isOutOfStock(): boolean {
    return this.product.Quantity <= 0;
  }
}
