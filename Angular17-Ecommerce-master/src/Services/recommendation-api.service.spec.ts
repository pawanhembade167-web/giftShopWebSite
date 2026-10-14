import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { RecommendationApi, RecommendationResult } from './recommendation-api.service';
import { environment } from '../environments/environment';

describe('RecommendationApi', () => {
  let api: RecommendationApi;
  let httpMock: HttpTestingController;

  const recommendationEnvelope = {
    success: true,
    message: 'Home recommendations fetched.',
    data: {
      strategy: 'personalized',
      recommendations: [
        {
          productId: 2,
          score: 0.91,
          reason: 'Similar to what you viewed',
          product: {
            id: 2, name: 'Nail Polish Red', brand: 'OPI', categoryId: 7, price: 8.5, rating: 4.0,
            reviewCount: 10, imageUrl: null, description: null, stock: 5,
          },
        },
      ],
    },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RecommendationApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('sends the anonymous id and limit when asking for home recommendations', () => {
    api.home(6).subscribe();

    const request = httpMock.expectOne((req) => req.url === `${environment.apiBaseUrl}/api/recommendations/home`);
    expect(request.request.params.get('limit')).toBe('6');
    expect(request.request.params.get('anonymousId')).toBeTruthy();
    request.flush(recommendationEnvelope);
  });

  it('maps each recommendation onto a storefront product with its reason and score', () => {
    let result: RecommendationResult | undefined;
    api.home().subscribe((value) => (result = value));

    httpMock.expectOne((req) => req.url.endsWith('/api/recommendations/home')).flush(recommendationEnvelope);

    expect(result?.strategy).toBe('personalized');
    expect(result?.items[0].productId).toBe(2);
    expect(result?.items[0].score).toBe(0.91);
    expect(result?.items[0].reason).toBe('Similar to what you viewed');
    expect(result?.items[0].product.Name).toBe('Nail Polish Red');
    expect(result?.items[0].product.Factory).toBe('OPI');
  });

  it('requests similar products for a given product id', () => {
    api.similar(9, 4).subscribe();

    const request = httpMock.expectOne((req) => req.url.startsWith(`${environment.apiBaseUrl}/api/recommendations/similar/9`));
    expect(request.request.params.get('limit')).toBe('4');
    request.flush({ success: true, message: '', data: { strategy: 'content', recommendations: [] } });
  });

  it('requests frequently bought products for a given product id', () => {
    api.frequentlyBought(9).subscribe();

    httpMock.expectOne((req) => req.url.startsWith(`${environment.apiBaseUrl}/api/recommendations/frequently-bought/9`))
      .flush({ success: true, message: '', data: { strategy: 'co-view', recommendations: [] } });
  });
});
