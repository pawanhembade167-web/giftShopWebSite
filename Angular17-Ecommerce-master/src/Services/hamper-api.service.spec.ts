import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HamperApi, HamperRequest } from './hamper-api.service';
import { environment } from '../environments/environment';

describe('HamperApi', () => {
  let api: HamperApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HamperApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the hamper request with its items and returns the saved summary', () => {
    const request: HamperRequest = {
      title: 'Birthday hamper', occasion: 'Birthday', recipientName: 'Priya', message: null, budget: 2000,
      deliveryDate: null, giftWrap: true, addressId: 3, items: [{ productId: 4, quantity: 2 }],
    };
    let saved: { id: number } | undefined;
    api.create(request).subscribe((hamper) => (saved = hamper));

    const call = httpMock.expectOne(`${environment.apiBaseUrl}/api/hampers`);
    expect(call.request.method).toBe('POST');
    expect(call.request.body.items).toEqual([{ productId: 4, quantity: 2 }]);
    call.flush({ success: true, message: '', data: { hamper: { id: 9, title: 'Birthday hamper', estimatedTotal: 500, status: 'REQUESTED', createdAt: '' } } });
    expect(saved?.id).toBe(9);
  });
});
