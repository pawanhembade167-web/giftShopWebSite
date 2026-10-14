import { Injectable } from '@angular/core';

export interface GuestCartEntry {
  productId: number;
  quantity: number;
}

const STORAGE_KEY = 'echomart.guestCart';
export const GUEST_CART_MAX_LINE = 20;

/**
 * Holds the cart of a shopper who is not signed in. It is only a convenience: the list is
 * merged into the account when they sign in, and storage failures leave the cart empty
 * rather than breaking the page.
 */
@Injectable({
  providedIn: 'root'
})
export class GuestCart {
  read(): GuestCartEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (entry): entry is GuestCartEntry =>
          typeof entry?.productId === 'number' && typeof entry?.quantity === 'number' && entry.quantity > 0
      );
    } catch {
      return [];
    }
  }

  add(productId: number, quantity: number): void {
    const entries = this.read();
    const existing = entries.find((entry) => entry.productId === productId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, GUEST_CART_MAX_LINE);
    } else {
      entries.push({ productId, quantity: Math.min(quantity, GUEST_CART_MAX_LINE) });
    }
    this.write(entries);
  }

  setQuantity(productId: number, quantity: number): void {
    const entries = this.read()
      .map((entry) => (entry.productId === productId ? { ...entry, quantity: Math.min(quantity, GUEST_CART_MAX_LINE) } : entry))
      .filter((entry) => entry.quantity > 0);
    this.write(entries);
  }

  remove(productId: number): void {
    this.write(this.read().filter((entry) => entry.productId !== productId));
  }

  clear(): void {
    this.write([]);
  }

  private write(entries: GuestCartEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage unavailable: the cart simply does not persist for this visit.
    }
  }
}
