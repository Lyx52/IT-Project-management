import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthUser } from '../models/auth.model';
import { authGuard } from './auth-guard';

const USER: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: false,
};

describe('authGuard', () => {
  const run = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );

  const setup = (signedIn: boolean) => {
    if (signedIn) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(USER));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('lets a signed-in user through', () => {
    setup(true);

    expect(run('/profile')).toBe(true);
  });

  it('sends a visitor to the sign-in page', () => {
    setup(false);

    const result = run('/profile');

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('/login');
  });

  it('remembers where the visitor was headed', () => {
    setup(false);

    expect(String(run('/profile'))).toContain('returnUrl=%2Fprofile');
  });

  it('keeps query parameters of the blocked url in the returnUrl', () => {
    setup(false);

    expect(String(run('/items?type=lost'))).toContain('returnUrl=%2Fitems%3Ftype%3Dlost');
  });
});
