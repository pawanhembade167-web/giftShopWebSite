import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import IProduct from '../../models/IProduct';
import { HOME_CATEGORY_COUNT, HOME_FEATURED_COUNT, PRODUCT_PAGE_SIZE, RECENTLY_VIEWED_DISPLAY_COUNT } from '../../models/product-display.constants';
import { AddToCartService } from '../../Services/add-to-cart.service';
import { CatalogApiService } from '../../Services/catalog-api.service';
import { CategoryStore } from '../../Services/category-store.service';
import { EventTracker } from '../../Services/event-tracker.service';
import { RecommendationApi, RecommendationResult, RecommendedProduct } from '../../Services/recommendation-api.service';
import { RecentlyViewedService } from '../../Services/recently-viewed.service';
import { ProductCardComponent } from '../shared/product-card/product-card.component';

@Component({
  selector: 'app-storefront-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './storefront-home.component.html',
  styleUrl: './storefront-home.component.scss'
})
export class StorefrontHomeComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly addToCartService = inject(AddToCartService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly recentlyViewed = inject(RecentlyViewedService);
  private readonly recommendationApi = inject(RecommendationApi);
  private readonly tracker = inject(EventTracker);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = this.categoryStore.categories;
  readonly featuredCategories = computed(() => this.categories().slice(0, HOME_CATEGORY_COUNT));
  readonly skeletonSlots = Array.from({ length: PRODUCT_PAGE_SIZE / 2 }, (_, index) => index);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly featured = signal<IProduct[]>([]);
  readonly recentlyViewedProducts = signal<IProduct[]>([]);
  readonly recommended = signal<RecommendedProduct[]>([]);
  readonly recommendationStrategy = signal<string>('');

  readonly recommendationHint = computed(() =>
    this.recommendationStrategy() === 'personalized' ? 'Based on what you have browsed' : 'Popular right now'
  );

  ngOnInit(): void {
    this.categoryStore.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.load();
    this.loadRecommendations();
  }

  trackClick(product: IProduct, reason: string | null): void {
    this.tracker.track({ eventType: 'PRODUCT_CLICK', productId: product.id, source: reason ? 'recommendation' : 'home' }).subscribe();
  }

  private loadRecommendations(): void {
    this.recommendationApi
      .home(8)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: RecommendationResult) => {
          this.recommendationStrategy.set(result.strategy);
          this.recommended.set(result.items);
        },
        error: () => this.recommended.set([])
      });
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.catalogApi
      .getProducts({ inStock: true, pageSize: HOME_FEATURED_COUNT, sort: 'rating' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.featured.set(page.items);
          this.loading.set(false);
          this.loadRecentlyViewed();
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        }
      });
  }

  addToCart(product: IProduct): void {
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

  private loadRecentlyViewed(): void {
    const ids = this.recentlyViewed.getIds().slice(0, RECENTLY_VIEWED_DISPLAY_COUNT);
    if (ids.length === 0) {
      return;
    }
    this.fetchProducts(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => this.recentlyViewedProducts.set(products));
  }

  private fetchProducts(ids: number[]): Observable<IProduct[]> {
    return forkJoin(ids.map((id) => this.catalogApi.getProduct(id).pipe(catchError(() => of(null))))).pipe(
      map((products) => products.filter((product): product is IProduct => product !== null))
    );
  }
}
