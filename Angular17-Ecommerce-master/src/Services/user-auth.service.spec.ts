import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { UserAuthenService } from './user-auth.service';
import { DataTransferServiceService } from './data-transfer-service.service';
import { AuthSessionStore } from './auth-session.store';
import { environment } from '../environments/environment';

describe('UserAuthenService', () => {
  let service: UserAuthenService;
  let httpMock: HttpTestingController;
  let dataTransfer: DataTransferServiceService;
  let sessionStore: AuthSessionStore;

  const authUrl = `${environment.apiBaseUrl}/api/auth`;
  const sessionPayload = {
    success: true,
    message: 'Signed in successfully.',
    data: {
      accessToken: 'access-token-123',
      tokenType: 'bearer',
      expiresIn: 900,
      user: { id: 7, fullName: 'Asha Rao', email: 'asha@example.com', phone: '+919876543210', role: 'CUSTOMER' },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(UserAuthenService);
    httpMock = TestBed.inject(HttpTestingController);
    dataTransfer = TestBed.inject(DataTransferServiceService);
    sessionStore = TestBed.inject(AuthSessionStore);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('signIn', () => {
    it('keeps the access token in memory and marks the user as logged in', () => {
      const statuses: boolean[] = [];
      service.getUserLoggedStatus().subscribe((status) => statuses.push(status));

      service.signIn('asha@example.com', 'Secret123').subscribe();
      const request = httpMock.expectOne(`${authUrl}/login`);
      expect(request.request.withCredentials).toBeTrue();
      expect(request.request.body).toEqual({ email: 'asha@example.com', password: 'Secret123' });
      request.flush(sessionPayload);

      expect(sessionStore.accessToken).toBe('access-token-123');
      expect(dataTransfer.getLoggedUser().id).toBe(7);
      expect(statuses[statuses.length - 1]).toBeTrue();
    });

    it('propagates an invalid-credentials error and stays logged out', () => {
      let failure: HttpErrorResponse | undefined;
      service.signIn('asha@example.com', 'wrong').subscribe({ error: (error) => (failure = error) });

      httpMock.expectOne(`${authUrl}/login`).flush({ success: false, message: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

      expect(failure?.status).toBe(401);
      expect(dataTransfer.getLoggedUser()).toBeFalsy();
      expect(sessionStore.accessToken).toBeNull();
    });
  });

  describe('signUp', () => {
    it('creates the account and then signs the new user in', () => {
      let signedIn = false;
      service
        .signUp({ fullName: 'Asha Rao', email: 'asha@example.com', phone: '+919876543210', password: 'Secret123' })
        .subscribe(() => (signedIn = true));

      const create = httpMock.expectOne(`${authUrl}/signup`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual({ fullName: 'Asha Rao', email: 'asha@example.com', phone: '+919876543210', password: 'Secret123' });
      create.flush({ success: true, message: 'Account created successfully.', data: {} }, { status: 201, statusText: 'Created' });

      httpMock.expectOne(`${authUrl}/login`).flush(sessionPayload);
      expect(signedIn).toBeTrue();
      expect(dataTransfer.getLoggedUser().id).toBe(7);
    });
  });

  describe('restoreSession', () => {
    it('signs the user back in from the refresh cookie on startup', () => {
      let restored: boolean | undefined;
      service.restoreSession().subscribe((result) => (restored = result));

      const request = httpMock.expectOne(`${authUrl}/refresh`);
      expect(request.request.withCredentials).toBeTrue();
      request.flush(sessionPayload);

      expect(restored).toBeTrue();
      expect(sessionStore.accessToken).toBe('access-token-123');
    });

    it('reports signed out when there is no valid refresh cookie', () => {
      let restored: boolean | undefined;
      service.restoreSession().subscribe((result) => (restored = result));

      httpMock.expectOne(`${authUrl}/refresh`).flush({ success: false, message: 'Please sign in to continue.' }, { status: 401, statusText: 'Unauthorized' });

      expect(restored).toBeFalse();
      expect(dataTransfer.getLoggedUser()).toBeFalsy();
    });
  });

  describe('logout', () => {
    it('clears the in-memory session and asks the API to clear the cookie', () => {
      service.signIn('asha@example.com', 'Secret123').subscribe();
      httpMock.expectOne(`${authUrl}/login`).flush(sessionPayload);

      service.logout();

      httpMock.expectOne(`${authUrl}/logout`).flush({ success: true, message: 'Signed out successfully.', data: {} });
      expect(sessionStore.accessToken).toBeNull();
      expect(dataTransfer.getLoggedUser()).toBeFalsy();
    });
  });
});
