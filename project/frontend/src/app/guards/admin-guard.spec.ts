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
import { adminGuard } from './admin-guard';

const USER = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: '2026-11-12T00:00:00Z',
  role: 'user',
};

const ADMIN = { ...USER, id: 1, username: 'boss', role: 'admin' };

describe('adminGuard', () => {
  const run = (url: string) =>
    TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );

  const setup = (user: typeof USER | null) => {
    if (user) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(user));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('lets an admin through', () => {
    setup(ADMIN);

    expect(run('/admin')).toBe(true);
  });

  it('sends a visitor to sign in, remembering where they were going', () => {
    setup(null);

    const result = run('/admin');

    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('/login');
    expect(String(result)).toContain('returnUrl=%2Fadmin');
  });

  it('sends a signed-in non-admin to the feed, not to a sign-in form', () => {
    setup(USER);

    const result = run('/admin');

    // Offering them a login form would imply the right account could get them
    // in; they are already signed in, so the answer is simply no.
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('/home');
    expect(String(result)).not.toContain('/login');
  });
});
