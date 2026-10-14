import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ProductPageComponent } from './product-page.component';
import { CatalogApiService } from '../../Services/catalog-api.service';
import IProduct from '../../models/IProduct';

describe('ProductPageComponent', () => {
  const product: IProduct = { id: 3, Name: 'MSI Katana 15', Quantity: 50, Price: 999, Factory: 'MSI', Categoryid: 1 };
  let api: jasmine.SpyObj<CatalogApiService>;

  beforeEach(() => {
    localStorage.clear();
    api = jasmine.createSpyObj<CatalogApiService>('CatalogApiService', ['getProduct', 'getCategories']);
    api.getCategories.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'prd/:productID', component: ProductPageComponent }]),
        { provide: CatalogApiService, useValue: api },
      ],
    });
  });

  it('shows the product name and price in rupees once loaded', async () => {
    api.getProduct.and.returnValue(of(product));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/prd/3', ProductPageComponent);

    expect(api.getProduct).toHaveBeenCalledWith(3);
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('MSI Katana 15');
    expect(text).toContain('₹999');
  });

  it('shows the not found state when the product does not exist', async () => {
    api.getProduct.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/prd/999', ProductPageComponent);

    expect(harness.routeNativeElement?.textContent).toContain('no longer available');
  });
});
