import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HamperBuilderComponent } from './hamper-builder.component';
import { CatalogApiService } from '../../Services/catalog-api.service';
import IProduct from '../../models/IProduct';

describe('HamperBuilderComponent', () => {
  let fixture: ComponentFixture<HamperBuilderComponent>;
  let component: HamperBuilderComponent;
  const candle: IProduct = { id: 1, Name: 'Scented Candle', Quantity: 5, Price: 250 };
  const catalog = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', ['getProducts']);

  beforeEach(async () => {
    catalog.getProducts.and.returnValue(of({ items: [candle], page: 1, pageSize: 12, total: 1, totalPages: 1 }));
    await TestBed.configureTestingModule({
      imports: [HamperBuilderComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: CatalogApiService, useValue: catalog }],
    }).compileComponents();
    fixture = TestBed.createComponent(HamperBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows matching products as a dropdown list under the search box', fakeAsync(() => {
    component.onSearchInput('candle');
    tick(400);
    fixture.detectChanges();

    const list = (fixture.nativeElement as HTMLElement).querySelector('.hamper__suggest');
    expect(list).not.toBeNull();
    expect(list?.textContent).toContain('Scented Candle');
  }));

  it('opens with every in-stock product listed when nothing is typed', fakeAsync(() => {
    component.openSuggestions();
    tick(400);
    fixture.detectChanges();

    expect(catalog.getProducts).toHaveBeenCalledWith(jasmine.objectContaining({ q: null, inStock: true }));
    expect(component.results().map((p) => p.Name)).toEqual(['Scented Candle']);
  }));

  it('loads the next page of products when Show more is used', fakeAsync(() => {
    catalog.getProducts.and.returnValue(of({ items: [candle], page: 1, pageSize: 50, total: 120, totalPages: 3 }));
    component.openSuggestions();
    tick(400);
    component.loadMore();
    tick(0);

    expect(catalog.getProducts).toHaveBeenCalledWith(jasmine.objectContaining({ page: 2 }));
  }));

  it('adds a product from the list and clears the search', () => {
    component.onSearchInput('candle');
    component.pick(candle);

    expect(component.lines().length).toBe(1);
    expect(component.query()).toBe('');
    expect(component.suggestOpen()).toBeFalse();
  });

  it('closes the dropdown when Escape is pressed', () => {
    component.suggestOpen.set(true);

    component.onEscape();

    expect(component.suggestOpen()).toBeFalse();
  });
});
