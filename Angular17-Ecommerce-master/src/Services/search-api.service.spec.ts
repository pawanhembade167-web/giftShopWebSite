import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SearchApi } from './search-api.service';
import { environment } from '../environments/environment';

describe('SearchApi', () => {
  let api: SearchApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(SearchApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends the typed term and maps the suggestions to storefront products', () => {
    let result: { products: { Name: string }[]; categories: { name: string }[] } | undefined;
    api.suggestions('gel').subscribe((value) => (result = value));

    const request = httpMock.expectOne((req) => req.url === `${environment.apiBaseUrl}/api/search/suggestions`);
    expect(request.request.params.get('q')).toBe('gel');
    request.flush({
      success: true,
      message: '',
      data: {
        products: [{ id: 1, name: 'Gel Polish', brand: 'OPI', categoryId: 2, price: 5, rating: 4, reviewCount: 1,
          imageUrl: null, description: null, stock: 3 }],
        categories: [{ id: 2, name: 'Beauty' }],
        subcategories: [],
      },
    });

    expect(result?.products[0].Name).toBe('Gel Polish');
    expect(result?.categories[0].name).toBe('Beauty');
  });
});
