import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ProductsWithApiService } from './products-with-api.service';
import { environment } from '../environments/environment';
import IProduct from '../models/IProduct';

describe('ProductsWithApiService', () => {
  let service: ProductsWithApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductsWithApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPrdByID', () => {
    it('requests the product resource by its id', () => {
      const product: IProduct = { id: 7, Name: 'MSI Katana', Quantity: 50, Price: 999 };
      let received: IProduct | undefined;

      service.getPrdByID(7).subscribe((result) => (received = result));

      const request = httpMock.expectOne(`${environment.legacyApiBaseUrl}/products/7`);
      expect(request.request.method).toBe('GET');
      request.flush(product);
      expect(received).toEqual(product);
    });
  });

  describe('getAllPrds', () => {
    it('requests the full product collection', () => {
      service.getAllPrds().subscribe();

      const request = httpMock.expectOne(`${environment.legacyApiBaseUrl}/products`);
      expect(request.request.method).toBe('GET');
      request.flush([]);
    });
  });

  describe('getPersonalRecommendations', () => {
    it('requests recommendations for the given user id', () => {
      service.getPersonalRecommendations(3).subscribe();

      const request = httpMock.expectOne(`${environment.legacyApiBaseUrl}/personal_recommendations?user_id=3`);
      expect(request.request.method).toBe('GET');
      request.flush([]);
    });
  });
});
