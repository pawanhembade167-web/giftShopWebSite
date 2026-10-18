import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { HamperBuilderComponent } from './hamper-builder.component';
import { CatalogApiService } from '../../Services/catalog-api.service';
import { CommerceApi, AddressDto } from '../../Services/commerce-api.service';
import { HamperApi } from '../../Services/hamper-api.service';
import IProduct from '../../models/IProduct';

describe('HamperBuilderComponent', () => {
  let fixture: ComponentFixture<HamperBuilderComponent>;
  let component: HamperBuilderComponent;
  const candle: IProduct = { id: 1, Name: 'Scented Candle', Quantity: 5, Price: 250 };
  const home: AddressDto = {
    id: 5, fullName: 'Asha', phone: '9876543210', line1: '12 MG Road', line2: null,
    city: 'Bengaluru', state: 'Karnataka', postalCode: '560001', country: 'IN', isDefault: true,
  };
  const catalog = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', ['getProducts']);
  const commerce = jasmine.createSpyObj<CommerceApi>('CommerceApi', ['listAddresses']);
  const hamperApi = jasmine.createSpyObj<HamperApi>('HamperApi', ['create']);

  beforeEach(async () => {
    catalog.getProducts.and.returnValue(of({ items: [candle], page: 1, pageSize: 12, total: 1, totalPages: 1 }));
    commerce.listAddresses.and.returnValue(of([home]));
    hamperApi.create.and.returnValue(of({ id: 1, title: '', estimatedTotal: 0, status: 'REQUESTED', createdAt: '' }));
    await TestBed.configureTestingModule({
      imports: [HamperBuilderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CatalogApiService, useValue: catalog },
        { provide: CommerceApi, useValue: commerce },
        { provide: HamperApi, useValue: hamperApi },
      ],
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

  it('offers the shopper their saved addresses for delivery', () => {
    expect(commerce.listAddresses).toHaveBeenCalled();
    expect(component.addresses()).toEqual([home]);
  });

  it('sends the chosen delivery address with the hamper request', () => {
    component.pick(candle);
    component.form.patchValue({ title: 'Diwali hamper', recipientName: 'Priya', addressId: home.id });

    component.submit();

    expect(hamperApi.create).toHaveBeenCalledWith(jasmine.objectContaining({ addressId: home.id }));
  });

  it('does not send a hamper request until a delivery address is chosen', () => {
    hamperApi.create.calls.reset();
    component.pick(candle);
    component.form.patchValue({ title: 'Diwali hamper', recipientName: 'Priya' });

    component.submit();

    expect(hamperApi.create).not.toHaveBeenCalled();
  });
});
