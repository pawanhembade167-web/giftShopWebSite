import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminApi } from './admin-api.service';
import { environment } from '../environments/environment';

describe('AdminApi', () => {
  let api: AdminApi;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/api/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(AdminApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends a status change to the order status endpoint', () => {
    api.changeOrderStatus(42, 'CONFIRMED').subscribe();

    const request = httpMock.expectOne(`${base}/orders/42/status`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'CONFIRMED' });
    request.flush({});
  });

  it('marks a cash order paid through the payment endpoint', () => {
    api.markPaid(7).subscribe();

    const request = httpMock.expectOne(`${base}/orders/7/payment`);
    expect(request.request.body).toEqual({ paid: true });
    request.flush({});
  });

  it('filters the order list by status only when one is chosen', () => {
    api.orders('SHIPPED').subscribe();

    const request = httpMock.expectOne((req) => req.url === `${base}/orders`);
    expect(request.request.params.get('status')).toBe('SHIPPED');
    request.flush({ success: true, message: '', data: { orders: [] } });
  });

  it('removes a product by deactivating it through the delete endpoint', () => {
    api.removeProduct(3).subscribe();

    const request = httpMock.expectOne(`${base}/products/3`);
    expect(request.request.method).toBe('DELETE');
    request.flush({});
  });
});
