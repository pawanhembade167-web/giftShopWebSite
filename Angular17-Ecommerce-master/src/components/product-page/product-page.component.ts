import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, Subject, catchError, map, merge, of, switchMap, tap } from 'rxjs';
import IProduct from '../../models/IProduct';
import { ADD_TO_CART_ENABLED, PRODUCT_CURRENCY, PRODUCT_PLACEHOLDER_IMAGE } from '../../models/product-display.constants';
import { AddToCartService } from '../../Services/add-to-cart.service';
import { CatalogApiService } from '../../Services/catalog-api.service';
import { EventTracker } from '../../Services/event-tracker.service';
import { RecommendationApi, RecommendationResult, RecommendedProduct } from '../../Services/recommendation-api.service';
import { WishlistStore } from '../../Services/wishlist-store.service';
import { UserAuthenService } from '../../Services/user-auth.service';
import { messageFrom } from '../../Services/error-message';
import { CategoryStore } from '../../Services/category-store.service';
import { RecentlyViewedService } from '../../Services/recently-viewed.service';
import { ProductCardComponent } from '../shared/product-card/product-card.component';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.scss'
})
export class ProductPageComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly addToCartService = inject(AddToCartService);
  private readonly recentlyViewed = inject(RecentlyViewedService);
  private readonly recommendationApi = inject(RecommendationApi);
  readonly wishlist = inject(WishlistStore);
  private readonly auth = inject(UserAuthenService);
  private readonly tracker = inject(EventTracker);
  private readonly retryRequests = new Subject<void>();

  readonly currency = PRODUCT_CURRENCY;
  readonly placeholderImage = PRODUCT_PLACEHOLDER_IMAGE;
  readonly addToCartEnabled = ADD_TO_CART_ENABLED;

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly loadFailed = signal(false);
  readonly product = signal<IProduct | null>(null);
  readonly zoomOrigin = signal('50% 50%');
  readonly similar = signal<RecommendedProduct[]>([]);
  readonly alsoLike = signal<RecommendedProduct[]>([]);
  readonly frequentlyBought = signal<RecommendedProduct[]>([]);
  readonly frequentlyBoughtReason = signal<string>('Frequently bought together');

  readonly inStock = computed(() => (this.product()?.Quantity ?? 0) > 0);
  readonly hasReviews = computed(() => (this.product()?.Rating ?? 0) > 0 && (this.product()?.ReviewCount ?? 0) > 0);
  readonly categoryName = computed(() => {
    const categoryId = this.product()?.Categoryid;
    return this.categoryStore.categories().find((category) => category.id === categoryId)?.name ?? '—';
  });

  ngOnInit(): void {
    merge(this.route.paramMap, this.retryRequests.pipe(map(() => this.route.snapshot.paramMap)))
      .pipe(
        map((params) => Number(params.get('productID'))),
        tap(() => this.resetState()),
        switchMap((productId) => this.fetchProduct(productId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((product) => {
        if (product) {
          this.product.set(product);
          this.loading.set(false);
          this.recentlyViewed.record(product.id);
          this.trackView(product.id);
          this.loadRecommendations(product.id);
        }
      });
    this.categoryStore.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  retry(): void {
    this.retryRequests.next();
  }

  onZoomMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.zoomOrigin.set(`${x}% ${y}%`);
  }

  resetZoom(): void {
    this.zoomOrigin.set('50% 50%');
  }

  addProductToCart(product: IProduct): void {
    this.addToCartService.addProduct(product).subscribe({
      next: (result) => {
        if (result === 'login-required') {
          this.router.navigate(['/login']);
          return;
        }
        this.toast.success(`${product.Name} added to your cart.`);
      },
      error: () => this.toast.error('We could not add that item to your cart. Please try again.')
    });
  }

  buyNow(product: IProduct): void {
    this.addToCartService.addProduct(product).subscribe({
      next: () => this.router.navigate(['/checkout']),
      error: (error) => this.toast.error(messageFrom(error, 'We could not add that item to your cart. Please try again.'))
    });
  }

  toggleWishlist(product: IProduct): void {
    if (!this.auth.isUserLogged) {
      this.toast.info('Sign in to save items to your wishlist.');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const wasSaved = this.wishlist.isSaved(product.id);
    const action = wasSaved ? this.wishlist.remove(product.id) : this.wishlist.add(product);
    action.subscribe({
      next: () => this.toast.success(wasSaved ? `${product.Name} was removed from your wishlist.` : `${product.Name} was added to your wishlist.`),
      error: (error) => this.toast.error(messageFrom(error, 'We could not update your wishlist. Please try again.'))
    });
  }

  private resetState(): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.loadFailed.set(false);
    this.product.set(null);
    this.zoomOrigin.set('50% 50%');
    this.similar.set([]);
    this.alsoLike.set([]);
    this.frequentlyBought.set([]);
  }

  trackClick(product: IProduct, reason: string | null): void {
    this.tracker.track({ eventType: 'PRODUCT_CLICK', productId: product.id, source: reason ? 'recommendation' : 'product-page' }).subscribe();
  }

  private trackView(productId: number): void {
    this.tracker.track({ eventType: 'PRODUCT_VIEW', productId }).subscribe();
  }

  private loadRecommendations(productId: number): void {
    this.recommendationApi.similar(productId, 4).subscribe({
      next: (result: RecommendationResult) => this.similar.set(result.items),
      error: () => this.similar.set([])
    });
    this.recommendationApi.forProduct(productId, 4).subscribe({
      next: (result: RecommendationResult) => this.alsoLike.set(result.items),
      error: () => this.alsoLike.set([])
    });
    this.recommendationApi.frequentlyBought(productId, 4).subscribe({
      next: (result: RecommendationResult) => {
        this.frequentlyBought.set(result.items);
        this.frequentlyBoughtReason.set(result.items[0]?.reason ?? 'Frequently bought together');
      },
      error: () => this.frequentlyBought.set([])
    });
  }

  private fetchProduct(productId: number): Observable<IProduct | null> {
    if (!Number.isInteger(productId)) {
      this.notFound.set(true);
      this.loading.set(false);
      return of(null);
    }

    return this.catalogApi.getProduct(productId).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.notFound.set(true);
        } else {
          this.loadFailed.set(true);
        }
        this.loading.set(false);
        return EMPTY;
      })
    );
  }
}
