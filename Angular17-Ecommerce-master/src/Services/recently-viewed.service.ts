import { Injectable } from '@angular/core';

export const RECENTLY_VIEWED_LIMIT = 8;
const STORAGE_KEY = 'echomart.recentlyViewed';

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {
  getIds(): number[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
    } catch {
      return [];
    }
  }

  record(productId: number): void {
    const ids = [productId, ...this.getIds().filter((id) => id !== productId)].slice(0, RECENTLY_VIEWED_LIMIT);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the feature degrades silently.
    }
  }
}
