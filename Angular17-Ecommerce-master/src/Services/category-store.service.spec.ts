import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CategoryStore } from './category-store.service';
import { environment } from '../environments/environment';

describe('CategoryStore', () => {
  let store: CategoryStore;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(CategoryStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('stores the categories returned by the API', () => {
    store.load().subscribe();

    httpMock.expectOne(`${environment.apiBaseUrl}/api/categories`)
      .flush({ success: true, message: '', data: { categories: [{ id: 1, name: 'Beauty', slug: 'beauty' }] } });

    expect(store.categories().map((c) => c.name)).toEqual(['Beauty']);
  });

  it('keeps an empty list when the API cannot be reached', () => {
    store.load().subscribe();

    httpMock.expectOne(`${environment.apiBaseUrl}/api/categories`).error(new ProgressEvent('error'));

    expect(store.categories()).toEqual([]);
  });
});
