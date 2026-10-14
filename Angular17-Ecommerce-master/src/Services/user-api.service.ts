import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { ADMIN_ROLE } from '../models/user-role';

export interface SignUpRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SessionUser {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: typeof ADMIN_ROLE | 'CUSTOMER';
}

export interface AuthSessionPayload {
  accessToken: string;
  tokenType: 'bearer';
  expiresIn: number;
  user: SessionUser;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private readonly authUrl = `${environment.apiBaseUrl}/api/auth`;

  constructor(private httpClient: HttpClient) {}

  signUp(request: SignUpRequest): Observable<ApiEnvelope<{ user: SessionUser }>> {
    return this.httpClient.post<ApiEnvelope<{ user: SessionUser }>>(`${this.authUrl}/signup`, request, { withCredentials: true });
  }

  signIn(request: SignInRequest): Observable<ApiEnvelope<AuthSessionPayload>> {
    return this.httpClient.post<ApiEnvelope<AuthSessionPayload>>(`${this.authUrl}/login`, request, { withCredentials: true });
  }

  refreshSession(): Observable<ApiEnvelope<AuthSessionPayload>> {
    return this.httpClient.post<ApiEnvelope<AuthSessionPayload>>(`${this.authUrl}/refresh`, {}, { withCredentials: true });
  }

  signOut(): Observable<ApiEnvelope<object>> {
    return this.httpClient.post<ApiEnvelope<object>>(`${this.authUrl}/logout`, {}, { withCredentials: true });
  }
}
