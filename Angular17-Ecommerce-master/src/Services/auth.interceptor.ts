import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../environments/environment';
import { AuthSessionStore } from './auth-session.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthSessionStore).accessToken;
  const isAuthApiCall = request.url.startsWith(environment.apiBaseUrl);

  if (!token || !isAuthApiCall) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
