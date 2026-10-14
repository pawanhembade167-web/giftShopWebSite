import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { EventTracker } from './event-tracker.service';
import { environment } from '../environments/environment';

describe('EventTracker', () => {
  let tracker: EventTracker;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    tracker = TestBed.inject(EventTracker);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('posts the event with a stable anonymous id for this browser', () => {
    tracker.track({ eventType: 'PRODUCT_VIEW', productId: 7 }).subscribe();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/api/events`);
    expect(request.request.body.eventType).toBe('PRODUCT_VIEW');
    expect(request.request.body.productId).toBe(7);
    expect(request.request.body.anonymousId).toBe(tracker.anonymousId());
    request.flush({});
  });

  it('reuses the same anonymous id across events', () => {
    const first = tracker.anonymousId();
    const second = tracker.anonymousId();

    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('completes quietly when the API rejects the event', () => {
    let completed = false;
    tracker.track({ eventType: 'SEARCH', query: 'nail' }).subscribe({ complete: () => (completed = true) });

    httpMock.expectOne(`${environment.apiBaseUrl}/api/events`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(completed).toBeTrue();
  });
});
