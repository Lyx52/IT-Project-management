import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthUser,
  CaptchaChallenge,
  CurrentUserResponse,
  LoginPayload,
  LoginResponse,
  LogoutResponse,
  RegisterPayload,
  RegisterResponse,
  ResendVerificationResponse,
} from '../models/auth.model';

const TOKEN_KEY = 'findit.token';
const USER_KEY = 'findit.user';

/** Names the row this client creates in `personal_access_tokens`. */
const DEVICE_NAME = 'web';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<AuthUser | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);

  /** Shown in the header. */
  readonly displayName = computed(() => this.currentUser()?.username ?? null);

  /** Whether the signed-in user has confirmed their address. */
  readonly isVerified = computed(() => {
    const user = this.currentUser();

    // Written out rather than `?.email_verified_at !== null`, which answers
    // `true` for a signed-out visitor: optional chaining yields undefined,
    // and undefined !== null.
    return user !== null && user.email_verified_at !== null;
  });

  /**
   * Whether the signed-in user has to verify their address before posting.
   * Drives the "verify your e-mail" prompt. False while the backend has
   * verification turned off, even though `isVerified` is false then too.
   */
  readonly mustVerifyEmail = computed(() => this.currentUser()?.must_verify_email === true);

  constructor() {
    // Read synchronously so the first render and the first guard check already
    // know who is signed in, rather than flashing a signed-out header.
    this.readFromStorage();
  }

  /** The bearer token, read by the HTTP interceptor. */
  token(): string | null {
    return this.accessToken();
  }

  /**
   * Creates an account. The payload must carry a challenge from `captcha()`
   * and its answer.
   *
   * Deliberately does not sign the user in and returns no token. When the
   * returned user has `must_verify_email`, a verification e-mail is on its way
   * and callers should say "check your e-mail"; otherwise the account can sign
   * in right away.
   */
  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<RegisterResponse>(`${environment.apiBaseUrl}/register`, payload)
      .pipe(map((response) => response.data));
  }

  /** Fetches a new math CAPTCHA for the registration form. */
  captcha(): Observable<CaptchaChallenge> {
    return this.http.get<CaptchaChallenge>(`${environment.apiBaseUrl}/captcha`);
  }

  /**
   * Exchanges credentials for a Sanctum token.
   *
   * Errors surface as HttpErrorResponse: 422 for wrong credentials, which the
   * backend reports under `errors.email` and callers must not repeat on the
   * field, and 403 for a banned account.
   */
  login(payload: LoginPayload): Observable<AuthUser> {
    const credentials: LoginPayload = { ...payload, device_name: DEVICE_NAME };

    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/login`, credentials).pipe(
      tap((response) => this.store(response.access_token, response.user)),
      map((response) => response.user),
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

  /**
   * Re-checks a token restored from storage, so a token revoked elsewhere does
   * not leave a stale name in the header and a verified badge that is no
   * longer true. Runs in the background at startup and never throws.
   */
  restore(): Observable<AuthUser | null> {
    const token = this.accessToken();

    if (!token) {
      return of(null);
    }

    return this.http.get<CurrentUserResponse>(`${environment.apiBaseUrl}/user`).pipe(
      map((response) => {
        this.store(token, response.data);
        return response.data;
      }),
      catchError(() => {
        this.clear();
        return of(null);
      }),
    );
  }

  /** Sends a new verification e-mail to the signed-in user. */
  resendVerification(): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>(`${environment.apiBaseUrl}/email/resend`, {});
  }

  /** Forgets the session locally. Also called by the interceptor on a 401. */
  clear(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.removeItem(TOKEN_KEY);
    this.removeItem(USER_KEY);
  }

  private store(token: string, user: AuthUser): void {
    this.accessToken.set(token);
    this.currentUser.set(user);
    this.writeItem(TOKEN_KEY, token);
    this.writeItem(USER_KEY, JSON.stringify(user));
  }

  private readFromStorage(): void {
    const token = this.readItem(TOKEN_KEY);
    const rawUser = this.readItem(USER_KEY);

    if (!token || !rawUser) {
      return;
    }

    try {
      this.accessToken.set(token);
      this.currentUser.set(JSON.parse(rawUser) as AuthUser);
    } catch {
      // Corrupt or hand-edited entry: start signed out rather than crash.
      this.clear();
    }
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
