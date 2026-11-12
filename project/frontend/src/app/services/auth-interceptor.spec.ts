import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthUser } from '../models/auth.model';
import { authInterceptor } from './auth-interceptor';
import { AuthService } from './auth';

const USER: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: false,
};

describe('authInterceptor', () => {
  const base = environment.apiBaseUrl;

  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  const setup = (signedIn: boolean) => {
    if (signedIn) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(USER));
    }

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('attaches the bearer token to an authenticated request', () => {
    setup(true);

    http.get(`${base}/user`).subscribe();

    const request = httpMock.expectOne(`${base}/user`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer stored-token');
    request.flush({ data: USER });
  });

  it('sends no Authorization header when nobody is signed in', () => {
    setup(false);

    http.get(`${base}/user`).subscribe({ error: () => undefined });

    const request = httpMock.expectOne(`${base}/user`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('never sends a token to the login endpoint', () => {
    setup(true);

    http.post(`${base}/login`, {}).subscribe({ error: () => undefined });

    const request = httpMock.expectOne(`${base}/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ message: 'Invalid credentials.' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('never sends a token to the register endpoint', () => {
    setup(true);

    http.post(`${base}/register`, {}).subscribe({ error: () => undefined });

    const request = httpMock.expectOne(`${base}/register`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 422, statusText: 'Unprocessable Content' });
  });

  it('does send the token to the logout endpoint, which needs it', () => {
    setup(true);

    http.post(`${base}/logout`, {}).subscribe();

    const request = httpMock.expectOne(`${base}/logout`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer stored-token');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('clears the session and redirects when a request comes back 401', () => {
    setup(true);

    http.post(`${base}/posts`, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/posts`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
  });

  it('does not redirect on a rejected sign-in attempt', () => {
    setup(false);

    http.post(`${base}/login`, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/login`)
      .flush({ message: 'Invalid credentials.' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when logout is refused, since that is the outcome wanted', () => {
    setup(true);

    http.post(`${base}/logout`, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/logout`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('signs out on a 401 from the startup session check, without redirecting', () => {
    setup(true);

    http.get(`${base}/user`).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/user`)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    // Cleared, but not dragged off a public page over a stale token.
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves other failures alone', () => {
    setup(true);

    http.post(`${base}/posts`, {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne(`${base}/posts`)
      .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
