import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { StorefrontHomeComponent } from './storefront-home.component';
import { CatalogApiService, CategoryDto } from '../../Services/catalog-api.service';
import { CategoryStore } from '../../Services/category-store.service';
import { RecommendationApi } from '../../Services/recommendation-api.service';
import { AddToCartService } from '../../Services/add-to-cart.service';
import { RecentlyViewedService } from '../../Services/recently-viewed.service';
import IProduct from '../../models/IProduct';

const flowers: CategoryDto = { id: 7, name: 'Flowers', slug: 'flowers', productCount: 117, subcategories: [] };
const rose: IProduct = { id: 31, Name: '17 Red Roses Bouquet', Quantity: 12, Price: 1189 };

describe('StorefrontHomeComponent', () => {
  let fixture: ComponentFixture<StorefrontHomeComponent>;
  let element: HTMLElement;
  let getProducts: jasmine.Spy;

  function render(categories: CategoryDto[]): void {
    getProducts = jasmine.createSpy('getProducts').and.returnValue(
      of({ items: [rose], page: 1, pageSize: 8, total: 1, totalPages: 1 })
    );
    TestBed.configureTestingModule({
      imports: [StorefrontHomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CatalogApiService, useValue: { getProducts, getProduct: () => of(rose) } },
        { provide: CategoryStore, useValue: { categories: signal(categories), load: () => of(categories) } },
        { provide: RecommendationApi, useValue: { home: () => of({ strategy: 'popular', items: [] }) } },
        { provide: AddToCartService, useValue: { addProduct: () => of('added') } },
        { provide: RecentlyViewedService, useValue: { getIds: () => [] } },
      ],
    });
    fixture = TestBed.createComponent(StorefrontHomeComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  }

  it('shows a flowers row with flower products when the Flowers category exists', () => {
    render([flowers]);

    expect(getProducts).toHaveBeenCalledWith(jasmine.objectContaining({ categoryId: flowers.id, inStock: true, pageSize: 8 }));
    expect(element.querySelector('#flowers-heading')?.textContent).toContain('Flowers');
    expect(element.textContent).toContain('17 Red Roses Bouquet');
  });

  it('hides the flowers row when there is no Flowers category', () => {
    render([{ ...flowers, name: 'Electronics', id: 3 }]);

    expect(getProducts).not.toHaveBeenCalledWith(jasmine.objectContaining({ categoryId: jasmine.anything() }));
    expect(element.querySelector('#flowers-heading')).toBeNull();
  });
});
