import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { CatalogComponent } from './catalog.component';
import { CatalogApiService, ProductPageResult } from '../../Services/catalog-api.service';
import { CategoryStore } from '../../Services/category-store.service';
import IProduct from '../../models/IProduct';

describe('CatalogComponent', () => {
  const chromebook: IProduct = { id: 1, Name: 'HP Chromebook 15', Quantity: 10, Price: 329, Factory: 'HP' };

  function pageOf(items: IProduct[]): ProductPageResult {
    return { items, page: 1, pageSize: 12, total: items.length, totalPages: 1 };
  }

  let api: jasmine.SpyObj<CatalogApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', ['getProducts', 'getBrands', 'getCategories']);
    api.getProducts.and.returnValue(of(pageOf([chromebook])));
    api.getBrands.and.returnValue(of([]));
    api.getCategories.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'products', component: CatalogComponent }]),
        { provide: CatalogApiService, useValue: api },
      ],
    });
  });

  it('lists only categories with products on sale, with their counts', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/products', CatalogComponent);
    TestBed.inject(CategoryStore).categories.set([
      { id: 1, name: 'Archies Collection', slug: 'a', productCount: 253, subcategories: [] },
      { id: 2, name: 'Occasions', slug: 'o', productCount: 0, subcategories: [] },
    ]);

    expect(page.categoryOptions()).toEqual([{ value: '1', label: 'Archies Collection (253)' }]);
  });

  it('asks the API for products matching the search term in the url', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products?q=chromebook', CatalogComponent);

    expect(api.getProducts).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'chromebook', page: 1 }));
    expect(harness.routeNativeElement?.querySelectorAll('app-product-card').length).toBe(1);
    expect(harness.routeNativeElement?.textContent).toContain('HP Chromebook 15');
  });

  it('shows the empty state when the API returns no products', async () => {
    api.getProducts.and.returnValue(of(pageOf([])));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products?q=nothing-matches-this', CatalogComponent);

    expect(harness.routeNativeElement?.textContent).toContain('No products match your filters');
  });

  it('requests the page and sort chosen in the url', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/products?sort=price-asc&page=2', CatalogComponent);

    expect(api.getProducts).toHaveBeenCalledWith(jasmine.objectContaining({ sort: 'price-asc', page: 2 }));
  });
});
