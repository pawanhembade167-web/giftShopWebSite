import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../environments/environment';

export type TrackedEventType =
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CLICK'
  | 'SEARCH'
  | 'CATEGORY_VIEW'
  | 'ADD_TO_CART'
  | 'WISHLIST';

export interface TrackedEvent {
  eventType: TrackedEventType;
  productId?: number;
  query?: string;
  categoryId?: number;
  source?: string;
}

const ANONYMOUS_ID_KEY = 'echomart.anonymousId';

/**
 * Sends shopping activity to the API for recommendations. Tracking is best-effort: a failure
 * is logged and never shown to the shopper.
 */
@Injectable({
  providedIn: 'root'
})
export class EventTracker {
  private readonly eventsUrl = `${environment.apiBaseUrl}/api/events`;

  constructor(private http: HttpClient) {}

  track(event: TrackedEvent): Observable<unknown> {
    const anonymousId = this.anonymousId();
    const body = anonymousId ? { ...event, anonymousId } : event;
    return this.http.post(this.eventsUrl, body).pipe(
      catchError((error) => {
        console.warn('Could not record activity', error);
        return of(null);
      })
    );
  }

  anonymousId(): string | null {
    try {
      const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
      if (existing && existing.length >= 8) {
        return existing;
      }
      const created = this.newId();
      localStorage.setItem(ANONYMOUS_ID_KEY, created);
      return created;
    } catch {
      return null;
    }
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}
