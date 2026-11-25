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
  const commerce = jasmine.createSpyObj<CommerceApi>('CommerceApi', ['listAddresses', 'createAddress']);
  const hamperApi = jasmine.createSpyObj<HamperApi>('HamperApi', ['create']);

  beforeEach(async () => {
    commerce.listAddresses.calls.reset();
    commerce.createAddress.calls.reset();
    hamperApi.create.calls.reset();
    catalog.getProducts.and.returnValue(of({ items: [candle], page: 1, pageSize: 12, total: 1, totalPages: 1 }));
    commerce.listAddresses.and.returnValue(of([home]));
    commerce.createAddress.and.returnValue(of(home));
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

  it('shows validation errors and does not send an incomplete request', () => {
    component.form.patchValue({ title: '  ', recipientName: '  ' });

    component.submit();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Enter a hamper name');
    expect(text).toContain('Enter a recipient name');
    expect(text).toContain('Choose or add a delivery address');
    expect(text).toContain('Add at least one item');
    expect(hamperApi.create).not.toHaveBeenCalled();
  });

  it('validates and saves a new delivery address, then selects it', () => {
    component.addingAddress.set(true);
    component.saveAddress();
    expect(commerce.createAddress).not.toHaveBeenCalled();
    expect(component.addressForm.controls.fullName.touched).toBeTrue();

    component.addressForm.patchValue({
      fullName: ' Asha ', phone: '9876543210', line1: '12 MG Road',
      city: 'Bengaluru', state: 'Karnataka', postalCode: '560001',
    });
    component.saveAddress();

    expect(commerce.createAddress).toHaveBeenCalledWith(jasmine.objectContaining({ fullName: 'Asha', line1: '12 MG Road' }));
    expect(component.form.controls.addressId.value).toBe(home.id);
    expect(component.addingAddress()).toBeFalse();
  });

  it('rejects a phone number without enough digits', () => {
    component.addressForm.patchValue({
      fullName: 'Asha', phone: '----------', line1: '12 MG Road',
      city: 'Bengaluru', state: 'Karnataka', postalCode: '560001',
    });

    component.saveAddress();

    expect(component.addressForm.controls.phone.invalid).toBeTrue();
    expect(commerce.createAddress).not.toHaveBeenCalled();
  });

  it('rejects invalid budgets and past delivery dates', () => {
    component.form.patchValue({ title: 'Birthday gift', recipientName: 'Priya', addressId: home.id, budget: 0, deliveryDate: '2000-01-01' });
    component.pick(candle);

    component.submit();
    fixture.detectChanges();

    expect(hamperApi.create).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Choose today or a later delivery date');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a budget greater than zero');
  });

  it('limits each item quantity to the API maximum', () => {
    const plentiful = { ...candle, Quantity: 50 };
    component.pick(plentiful);
    component.change(plentiful.id, 25);
    component.pick(plentiful);

    expect(component.lines()[0].quantity).toBe(20);
  });
});
