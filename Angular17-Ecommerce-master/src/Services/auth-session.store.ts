import { Injectable } from '@angular/core';

/**
 * Holds the short-lived access token in memory only. It is deliberately not written to
 * localStorage or sessionStorage, so a script that can read storage cannot take it.
 * The long-lived refresh token lives in an httpOnly cookie managed by the API.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthSessionStore {
  private token: string | null = null;

  get accessToken(): string | null {
    return this.token;
  }

  setAccessToken(token: string | null): void {
    this.token = token;
  }
}
