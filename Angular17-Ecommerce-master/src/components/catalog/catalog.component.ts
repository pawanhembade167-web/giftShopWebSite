import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { ToastService } from '../../Services/toast.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, map, merge, of, switchMap, tap } from 'rxjs';
import IProduct from '../../models/IProduct';
import { PRODUCT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '../../models/product-display.constants';
import { AddToCartService } from '../../Services/add-to-cart.service';
import { BrandDto, CatalogApiService, CatalogRequest, CatalogSort, ProductPageResult } from '../../Services/catalog-api.service';
import { CategoryStore } from '../../Services/category-store.service';
import { EventTracker } from '../../Services/event-tracker.service';
import { ProductCardComponent } from '../shared/product-card/product-card.component';
import { FixedSelectComponent, FixedSelectOption } from '../shared/fixed-select/fixed-select.component';
import { DEFAULT_PRODUCT_FILTER, ProductFilter, ProductSort, pageWindow, parseCatalogParams } from './product-query';

interface SortOption {
  value: ProductSort;
  label: string;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ProductCardComponent, FixedSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss'
})
export class CatalogComponent {
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly categoryStore = inject(CategoryStore);
  private readonly addToCartService = inject(AddToCartService);
  private readonly tracker = inject(EventTracker);
  private readonly reloadRequests = new Subject<void>();

  readonly categories = this.categoryStore.categories;
  readonly skeletonSlots = Array.from({ length: PRODUCT_PAGE_SIZE }, (_, index) => index);
  readonly sortOptions: SortOption[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'newest', label: 'Newest' },
    { value: 'rating', label: 'Best rated' },
  ];

  readonly brands = signal<BrandDto[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly products = signal<IProduct[]>([]);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly layout = signal<'grid' | 'list'>('grid');

  readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => parseCatalogParams(toRecord(params)))),
    { requireSync: true }
  );

  readonly searchControl = new FormControl(this.query().filter.search, { nonNullable: true });

  readonly hasActiveFilters = computed(
    () => JSON.stringify(this.query().filter) !== JSON.stringify(DEFAULT_PRODUCT_FILTER)
  );

  readonly subcategoryOptions = computed(() =>
    this.categories().find((category) => category.id === this.query().filter.categoryId)?.subcategories ?? []
  );
  readonly typeOptions = computed(() =>
    this.subcategoryOptions().find((sub) => sub.name === this.query().filter.subcategory)?.types ?? []
  );
  readonly selectedCategoryName = computed(() =>
    this.categories().find((category) => category.id === this.query().filter.categoryId)?.name ?? 'category'
  );
  readonly ratingSelectOptions: FixedSelectOption[] = [
    { value: '4.5', label: '4.5 & up' },
    { value: '4', label: '4 & up' },
    { value: '3', label: '3 & up' },
    { value: '2', label: '2 & up' },
    { value: '1', label: '1 & up' },
  ];
  readonly categoryOptions = computed<FixedSelectOption[]>(() =>
    this.categories()
      .filter((category) => category.productCount > 0)
      .map((category) => ({ value: String(category.id), label: `${category.name} (${category.productCount})` }))
  );
  readonly subcategorySelectOptions = computed<FixedSelectOption[]>(() =>
    this.subcategoryOptions().map((sub) => ({ value: sub.name, label: `${sub.name} (${sub.productCount})` }))
  );
  readonly typeSelectOptions = computed<FixedSelectOption[]>(() =>
    this.typeOptions().map((type) => ({ value: type.name, label: `${type.name} (${type.productCount})` }))
  );
  readonly brandSelectOptions = computed<FixedSelectOption[]>(() =>
    this.brands().map((brand) => ({ value: brand.name, label: `${brand.name} (${brand.productCount})` }))
  );
  readonly pageItems = computed(() => pageWindow(this.query().page, this.totalPages()));

  constructor() {
    this.categoryStore.load().subscribe();
    this.catalogApi.getBrands().subscribe({ next: (brands) => this.brands.set(brands), error: () => this.brands.set([]) });

    this.searchControl.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        const cleaned = term.trim();
        if (cleaned) {
          this.tracker.track({ eventType: 'SEARCH', query: cleaned }).subscribe();
        }
        this.updateParams({ q: cleaned || null, page: null });
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const term = params.get('q') ?? '';
        if (this.searchControl.value !== term) {
          this.searchControl.setValue(term, { emitEvent: false });
        }
      });

    merge(this.route.queryParamMap, this.reloadRequests.pipe(map(() => this.route.snapshot.queryParamMap)))
      .pipe(
        map((params) => parseCatalogParams(toRecord(params))),
        tap(() => this.startLoading()),
        switchMap((query) => this.fetchPage(query.filter, query.sort, query.page)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => this.showPage(result));
  }

  load(): void {
    this.reloadRequests.next();
  }

  setCategory(rawCategoryId: string): void {
    const categoryId = rawCategoryId === '' ? null : Number(rawCategoryId);
    if (categoryId !== null) {
      this.tracker.track({ eventType: 'CATEGORY_VIEW', categoryId }).subscribe();
    }
    this.updateParams({ category: categoryId, page: null });
  }

  setSubcategory(name: string): void {
    this.updateParams({ subcategory: name || null, type: null, page: null });
  }

  setProductType(name: string): void {
    this.updateParams({ type: name || null, page: null });
  }

  setMinRating(value: string): void {
    this.updateParams({ rating: value || null, page: null });
  }

  clearSubcategory(): void {
    this.updateParams({ subcategory: null, type: null, page: null });
  }

  setBrand(brand: string): void {
    this.updateParams({ brand: brand || null, page: null });
  }

  setPriceRange(min: string, max: string): void {
    this.updateParams({ min: min || null, max: max || null, page: null });
  }

  setInStockOnly(enabled: boolean): void {
    this.updateParams({ stock: enabled ? '1' : null, page: null });
  }

  setSort(sort: ProductSort): void {
    this.updateParams({ sort: sort === 'relevance' ? null : sort, page: null });
  }

  goToPage(page: number): void {
    this.updateParams({ page: page > 1 ? page : null });
  }

  clearFilters(): void {
    this.updateParams({ q: null, category: null, subcategory: null, type: null, rating: null, brand: null, min: null, max: null, stock: null, sort: null, page: null });
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

  private startLoading(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
  }

  private fetchPage(filter: ProductFilter, sort: CatalogSort, page: number): Observable<ProductPageResult | null> {
    const request: CatalogRequest = {
      q: filter.search || null,
      categoryId: filter.categoryId,
      subcategory: filter.subcategory,
      productType: filter.productType,
      minRating: filter.minRating,
      brand: filter.brand,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      inStock: filter.inStockOnly,
      sort,
      page,
      pageSize: PRODUCT_PAGE_SIZE,
    };
    return this.catalogApi.getProducts(request).pipe(
      catchError(() => {
        this.loadFailed.set(true);
        this.loading.set(false);
        return of(null);
      })
    );
  }

  private showPage(result: ProductPageResult | null): void {
    if (!result) {
      return;
    }
    this.products.set(result.items);
    this.total.set(result.total);
    this.totalPages.set(result.totalPages);
    this.loading.set(false);
  }

  private updateParams(changes: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }
}

function toRecord(params: ParamMap): Record<string, string | null> {
  return Object.fromEntries(params.keys.map((key) => [key, params.get(key)]));
}
