import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, switchMap } from 'rxjs';
import { AuthSessionPayload, SessionUser, SignUpRequest, UserApiService } from './user-api.service';
import { DataTransferServiceService } from './data-transfer-service.service';
import { AuthSessionStore } from './auth-session.store';

@Injectable({
  providedIn: 'root',
})
export class UserAuthenService {
  userLoggedBehavior: BehaviorSubject<boolean>;

  constructor(
    private userApi: UserApiService,
    private dataTransferService: DataTransferServiceService,
    private sessionStore: AuthSessionStore
  ) {
    this.userLoggedBehavior = new BehaviorSubject<boolean>(this.isUserLogged);
  }

  signIn(email: string, password: string): Observable<SessionUser> {
    return this.userApi.signIn({ email, password }).pipe(
      map((envelope) => this.startSession(envelope.data))
    );
  }

  signUp(request: SignUpRequest): Observable<SessionUser> {
    return this.userApi.signUp(request).pipe(
      switchMap(() => this.signIn(request.email, request.password))
    );
  }

  restoreSession(): Observable<boolean> {
    return this.userApi.refreshSession().pipe(
      map((envelope) => {
        this.startSession(envelope.data);
        return true;
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  logout(): void {
    this.userApi.signOut().subscribe({ error: () => undefined });
    this.clearSession();
  }

  get isUserLogged(): boolean {
    return this.dataTransferService.getLoggedUser() ? true : false;
  }

  getUserLoggedStatus(): Observable<boolean> {
    return this.userLoggedBehavior.asObservable();
  }

  private startSession(payload: AuthSessionPayload): SessionUser {
    this.sessionStore.setAccessToken(payload.accessToken);
    this.dataTransferService.setLoggedUser(payload.user);
    this.userLoggedBehavior.next(true);
    return payload.user;
  }

  private clearSession(): void {
    this.sessionStore.setAccessToken(null);
    this.dataTransferService.setLoggedUser(null);
    this.userLoggedBehavior.next(false);
  }
}
