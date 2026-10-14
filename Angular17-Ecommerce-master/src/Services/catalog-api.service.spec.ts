import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CatalogApiService, ProductDto, toProduct } from './catalog-api.service';
import { environment } from '../environments/environment';

describe('CatalogApiService', () => {
  let service: CatalogApiService;
  let httpMock: HttpTestingController;

  const dto: ProductDto = {
    id: 12,
    name: 'OPI Nail Lacquer',
    brand: 'OPI',
    categoryId: 3,
    price: 8.95,
    rating: 4.5,
    reviewCount: 120,
    imageUrl: 'https://img/12.jpg',
    description: 'Pink polish',
    stock: 7,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('toProduct', () => {
    it('maps the catalog fields onto the storefront product shape', () => {
      expect(toProduct(dto)).toEqual({
        id: 12,
        Name: 'OPI Nail Lacquer',
        Quantity: 7,
        Price: 8.95,
        Img: 'https://img/12.jpg',
        Categoryid: 3,
        Factory: 'OPI',
        Description: 'Pink polish',
        Rating: 4.5,
        ReviewCount: 120,
      });
    });

    it('leaves optional fields undefined when the API returns null', () => {
      const product = toProduct({ ...dto, brand: null, imageUrl: null, categoryId: null, description: null });

      expect(product.Factory).toBeUndefined();
      expect(product.Img).toBeUndefined();
      expect(product.Categoryid).toBeUndefined();
    });
  });

  describe('getProducts', () => {
    it('sends only the filters that are set as query parameters', () => {
      service.getProducts({ q: 'lacquer', categoryId: 3, inStock: true, sort: 'price-asc', page: 2, pageSize: 24, brand: null }).subscribe();

      const request = httpMock.expectOne((req) => req.url === `${environment.apiBaseUrl}/api/products`);
      expect(request.request.params.get('q')).toBe('lacquer');
      expect(request.request.params.get('categoryId')).toBe('3');
      expect(request.request.params.get('inStock')).toBe('true');
      expect(request.request.params.get('sort')).toBe('price-asc');
      expect(request.request.params.get('page')).toBe('2');
      expect(request.request.params.has('brand')).toBeFalse();
      request.flush({ success: true, message: '', data: { items: [dto], page: 2, pageSize: 24, total: 49, totalPages: 3 } });
    });

    it('returns mapped products with paging metadata', () => {
      let result: { total: number; items: { Name: string }[] } | undefined;
      service.getProducts().subscribe((page) => (result = page));

      httpMock.expectOne((req) => req.url.endsWith('/api/products'))
        .flush({ success: true, message: '', data: { items: [dto], page: 1, pageSize: 24, total: 1, totalPages: 1 } });

      expect(result?.total).toBe(1);
      expect(result?.items[0].Name).toBe('OPI Nail Lacquer');
    });
  });

  describe('getProduct', () => {
    it('requests a single product by id and maps it', () => {
      let product: { id: number } | undefined;
      service.getProduct(12).subscribe((result) => (product = result));

      httpMock.expectOne(`${environment.apiBaseUrl}/api/products/12`)
        .flush({ success: true, message: '', data: { product: dto } });

      expect(product?.id).toBe(12);
    });
  });

  describe('getCategories', () => {
    it('returns the category list from the API', () => {
      let categories: { name: string }[] = [];
      service.getCategories().subscribe((result) => (categories = result));

      httpMock.expectOne(`${environment.apiBaseUrl}/api/categories`)
        .flush({ success: true, message: '', data: { categories: [{ id: 3, name: 'Beauty', slug: 'beauty' }] } });

      expect(categories.map((c) => c.name)).toEqual(['Beauty']);
    });
  });
});
