import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthUser, RegisterPayload, RegisterResponse } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /**
   * Creates an account.
   *
   * The endpoint deliberately does not log the user in and returns no token:
   * it queues a verification e-mail and the account stays unverified until
   * that link is used. Callers should show a "check your e-mail" message.
   *
   * Errors surface as HttpErrorResponse: 422 with per-field messages,
   * or 429 when the throttle (5 requests per minute per IP) trips.
   */
  register(payload: RegisterPayload): Observable<AuthUser> {
    return this.http
      .post<RegisterResponse>(`${environment.apiBaseUrl}/register`, payload)
      .pipe(map((response) => response.data));
  }
}
