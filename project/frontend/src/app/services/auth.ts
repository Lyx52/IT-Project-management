import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthUser,
  LoginPayload,
  LoginResponse,
  LogoutResponse,
  RegisterPayload,
  RegisterResponse,
} from '../models/auth.model';

const TOKEN_KEY = 'findit.token';
const EMAIL_KEY = 'findit.email';

/** Names the row this client creates in `personal_access_tokens`. */
const DEVICE_NAME = 'web';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly accessToken = signal<string | null>(null);
  private readonly email = signal<string | null>(null);
  private readonly username = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  /**
   * What the header shows. The username is preferred but the login endpoint
   * does not return it and there is no endpoint to fetch it from, so the
   * address the user signed in with stands in. Once the backend returns the
   * user, `username` fills in and this switches over on its own.
   */
  readonly displayName = computed(() => this.username() ?? this.email());

  constructor() {
    // Read synchronously so the first render and the first guard check already
    // know whether someone is signed in, rather than flashing a signed-out header.
    this.readFromStorage();
  }

  /** The bearer token, read by the HTTP interceptor. */
  token(): string | null {
    return this.accessToken();
  }

  /**
   * Creates an account.
   *
   * Deliberately does not sign the user in and returns no token: it queues a
   * verification e-mail and the account stays unverified until that link is
   * used. Callers should show a "check your e-mail" message.
   */
  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<RegisterResponse>(`${environment.apiBaseUrl}/register`, payload)
      .pipe(map((response) => response.data));
  }

  /**
   * Exchanges credentials for a Sanctum token.
   *
   * Errors surface as HttpErrorResponse. The backend throws a
   * ValidationException for wrong credentials, so that arrives as 422 with the
   * message under `errors.email`; callers must not repeat it on the field,
   * because it would say which half was wrong.
   */
  login(payload: LoginPayload): Observable<void> {
    const credentials: LoginPayload = { ...payload, device_name: DEVICE_NAME };

    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/login`, credentials).pipe(
      tap((response) => this.store(response.access_token, payload.email)),
      map(() => undefined),
    );
  }

  /**
   * Revokes the token server-side and signs out locally.
   *
   * The local session is cleared even when the request fails, because leaving
   * someone in a signed-in UI holding a token they asked to destroy is worse
   * than a token that outlives the session.
   */
  logout(): Observable<void> {
    return this.http.post<LogoutResponse>(`${environment.apiBaseUrl}/logout`, {}).pipe(
      catchError(() => of(null)),
      tap(() => this.clear()),
      map(() => undefined),
    );
  }

  /** Forgets the session locally. Also called by the interceptor on a 401. */
  clear(): void {
    this.accessToken.set(null);
    this.email.set(null);
    this.username.set(null);
    this.removeItem(TOKEN_KEY);
    this.removeItem(EMAIL_KEY);
  }

  private store(token: string, email: string): void {
    this.accessToken.set(token);
    this.email.set(email);
    this.writeItem(TOKEN_KEY, token);
    this.writeItem(EMAIL_KEY, email);
  }

  /**
   * There is no endpoint to validate a stored token against, so a token that
   * was revoked elsewhere is only discovered when a real request returns 401,
   * which the interceptor handles. That costs nothing at startup, unlike
   * calling an endpoint on every page load.
   */
  private readFromStorage(): void {
    const token = this.readItem(TOKEN_KEY);

    if (!token) {
      return;
    }

    this.accessToken.set(token);
    this.email.set(this.readItem(EMAIL_KEY));
  }

  // localStorage throws in private mode and when site data is blocked, so
  // every access is guarded and a failure just means "no stored session".
  private readItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not fatal: the session still works until the page is reloaded.
    }
  }

  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
  }
}
