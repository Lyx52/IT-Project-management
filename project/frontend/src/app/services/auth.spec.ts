import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthUser, LoginPayload, RegisterPayload } from '../models/auth.model';
import { AuthService } from './auth';

const REGISTER_PAYLOAD: RegisterPayload = {
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse',
  password_confirmation: 'correct horse',
  terms_accepted: true,
  privacy_policy_version: '1.0',
  captcha_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  captcha_answer: '12',
};

const CREDENTIALS: LoginPayload = {
  email: 'jane@example.com',
  password: 'correct horse',
};

const USER: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: false,
};

describe('AuthService', () => {
  const base = environment.apiBaseUrl;

  let service: AuthService;
  let httpMock: HttpTestingController;

  /** Builds the service, optionally with a session already in storage. */
  const createService = (seed?: { token?: string; user?: AuthUser }) => {
    if (seed?.token) {
      localStorage.setItem('findit.token', seed.token);
    }
    if (seed?.user) {
      localStorage.setItem('findit.user', JSON.stringify(seed.user));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('register', () => {
    it('POSTs the payload unchanged to the versioned register endpoint', () => {
      createService();
      service.register(REGISTER_PAYLOAD).subscribe();

      const request = httpMock.expectOne(`${base}/register`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(REGISTER_PAYLOAD);

      request.flush({ data: USER });
    });

    it('unwraps the `data` envelope that JsonResource adds', () => {
      createService();
      let received: AuthUser | undefined;

      service.register(REGISTER_PAYLOAD).subscribe((user) => (received = user));
      httpMock.expectOne(`${base}/register`).flush({ data: USER });

      expect(received).toEqual(USER);
    });

    it('does not sign the new account in', () => {
      createService();

      service.register(REGISTER_PAYLOAD).subscribe();
      httpMock.expectOne(`${base}/register`).flush({ data: USER });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.token()).toBeNull();
    });

    it('passes a 422 through to the caller so fields can be flagged', () => {
      createService();
      let status: number | undefined;

      service.register(REGISTER_PAYLOAD).subscribe({
        error: (error) => (status = error.status),
      });

      httpMock
        .expectOne(`${base}/register`)
        .flush(
          { message: 'The email has already been taken.', errors: { email: ['Taken.'] } },
          { status: 422, statusText: 'Unprocessable Content' },
        );

      expect(status).toBe(422);
    });
  });

  describe('login', () => {
    it('POSTs the credentials and names the token for this client', () => {
      createService();
      service.login(CREDENTIALS).subscribe();

      const request = httpMock.expectOne(`${base}/login`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ ...CREDENTIALS, device_name: 'web' });

      request.flush({ access_token: '4|plain-text', token_type: 'Bearer', user: USER });
    });

    it('reads the token from `access_token` and signs the user in', () => {
      createService();

      service.login(CREDENTIALS).subscribe();
      httpMock
        .expectOne(`${base}/login`)
        .flush({ access_token: '4|plain-text', token_type: 'Bearer', user: USER });

      expect(service.isAuthenticated()).toBe(true);
      expect(service.token()).toBe('4|plain-text');
    });

    it('reads the username off the response for the header', () => {
      createService();

      service.login(CREDENTIALS).subscribe();
      httpMock
        .expectOne(`${base}/login`)
        .flush({ access_token: 't', token_type: 'Bearer', user: USER });

      expect(service.displayName()).toBe('jane_doe');
      expect(service.user()).toEqual(USER);
    });

    it('reports an unverified account, which drives the verify prompt', () => {
      createService();

      service.login(CREDENTIALS).subscribe();
      httpMock
        .expectOne(`${base}/login`)
        .flush({ access_token: 't', token_type: 'Bearer', user: USER });

      expect(service.isVerified()).toBe(false);
    });

    it('reports a verified account', () => {
      createService();

      service.login(CREDENTIALS).subscribe();
      httpMock.expectOne(`${base}/login`).flush({
        access_token: 't',
        token_type: 'Bearer',
        user: { ...USER, email_verified_at: '2026-11-12T00:00:00Z' },
      });

      expect(service.isVerified()).toBe(true);
    });

    it('persists the session so a reload stays signed in', () => {
      createService();

      service.login(CREDENTIALS).subscribe();
      httpMock
        .expectOne(`${base}/login`)
        .flush({ access_token: 't', token_type: 'Bearer', user: USER });

      expect(localStorage.getItem('findit.token')).toBe('t');
      expect(JSON.parse(localStorage.getItem('findit.user') ?? 'null')).toEqual(USER);
    });

    it('stays signed out when the credentials are refused', () => {
      createService();
      let status: number | undefined;

      service.login(CREDENTIALS).subscribe({ error: (error) => (status = error.status) });
      httpMock
        .expectOne(`${base}/login`)
        .flush(
          { message: 'These credentials do not match our records.', errors: { email: ['...'] } },
          { status: 422, statusText: 'Unprocessable Content' },
        );

      expect(status).toBe(422);
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.length).toBe(0);
    });
  });

  describe('logout', () => {
    it('revokes the token server-side and clears the session', () => {
      createService({ token: 't', user: USER });
      expect(service.isAuthenticated()).toBe(true);

      service.logout().subscribe();

      const request = httpMock.expectOne(`${base}/logout`);
      expect(request.request.method).toBe('POST');
      request.flush({ message: 'Successfully logged out.' });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.user()).toBeNull();
      expect(service.token()).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('still signs out locally when the request fails', () => {
      createService({ token: 't', user: USER });
      let completed = false;

      service.logout().subscribe(() => (completed = true));
      httpMock
        .expectOne(`${base}/logout`)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

      expect(completed).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.length).toBe(0);
    });
  });

  describe('restoring a session', () => {
    it('is signed in before any request is made', () => {
      createService({ token: 't', user: USER });

      expect(service.isAuthenticated()).toBe(true);
      expect(service.displayName()).toBe('jane_doe');
      // No request yet: restore() is called by the app initializer, not here.
      httpMock.verify();
    });

    it('makes no request when there is no stored token', () => {
      createService();
      let result: AuthUser | null | undefined;

      service.restore().subscribe((user) => (result = user));

      expect(result).toBeNull();
    });

    it('refreshes the cached user from the server', () => {
      createService({ token: 't', user: USER });
      const renamed: AuthUser = { ...USER, username: 'jane_renamed' };

      service.restore().subscribe();
      httpMock.expectOne(`${base}/user`).flush({ data: renamed });

      expect(service.displayName()).toBe('jane_renamed');
    });

    it('picks up verification that happened since the last sign-in', () => {
      createService({ token: 't', user: USER });
      expect(service.isVerified()).toBe(false);

      service.restore().subscribe();
      httpMock
        .expectOne(`${base}/user`)
        .flush({ data: { ...USER, email_verified_at: '2026-11-12T00:00:00Z' } });

      expect(service.isVerified()).toBe(true);
    });

    it('signs out when the stored token is no longer accepted', () => {
      createService({ token: 'revoked', user: USER });
      let result: AuthUser | null | undefined;

      service.restore().subscribe((user) => (result = user));
      httpMock
        .expectOne(`${base}/user`)
        .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

      expect(result).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.length).toBe(0);
    });

    it('starts signed out when the stored user is corrupt', () => {
      localStorage.setItem('findit.token', 't');
      localStorage.setItem('findit.user', 'not json');
      createService();

      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.length).toBe(0);
    });

    it('ignores a token with no matching user entry', () => {
      createService({ token: 'orphan' });

      expect(service.isAuthenticated()).toBe(false);
    });

    it('does not report a signed-out visitor as verified', () => {
      createService();

      // Guards against `?.email_verified_at !== null`, which answers true when
      // there is no user at all.
      expect(service.isVerified()).toBe(false);
    });
  });

  describe('mustVerifyEmail', () => {
    it('follows must_verify_email, not email_verified_at', () => {
      // Unverified, but the backend has verification turned off
      createService({ token: 't', user: USER });

      expect(service.isVerified()).toBe(false);
      expect(service.mustVerifyEmail()).toBe(false);
    });

    it('is true when the backend asks this user to verify', () => {
      createService({ token: 't', user: { ...USER, must_verify_email: true } });

      expect(service.mustVerifyEmail()).toBe(true);
    });

    it('is false for a signed-out visitor', () => {
      createService();

      expect(service.mustVerifyEmail()).toBe(false);
    });
  });

  describe('captcha', () => {
    it('GETs a new challenge', () => {
      createService();
      const challenge = {
        captcha_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        question: 'What is 7 + 5?',
        expires_in: 300,
      };
      let result: unknown;

      service.captcha().subscribe((c) => (result = c));
      const request = httpMock.expectOne(`${base}/captcha`);
      request.flush(challenge);

      expect(request.request.method).toBe('GET');
      expect(result).toEqual(challenge);
    });
  });

  describe('resendVerification', () => {
    it('POSTs to the resend endpoint', () => {
      createService({ token: 't', user: USER });

      service.resendVerification().subscribe();

      const request = httpMock.expectOne(`${base}/email/resend`);
      expect(request.request.method).toBe('POST');
      request.flush({ message: 'Verification e-mail sent.' });
    });
  });
});
