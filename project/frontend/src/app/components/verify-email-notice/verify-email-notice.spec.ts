import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../../models/auth.model';
import { VerifyEmailNotice } from './verify-email-notice';

const UNVERIFIED: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: true,
};

const VERIFIED: AuthUser = {
  ...UNVERIFIED,
  email_verified_at: '2026-11-12T00:00:00Z',
  must_verify_email: false,
};

/** Unverified, but the backend has verification turned off. */
const VERIFICATION_OFF: AuthUser = { ...UNVERIFIED, must_verify_email: false };

describe('VerifyEmailNotice', () => {
  const url = `${environment.apiBaseUrl}/email/resend`;

  let fixture: ComponentFixture<VerifyEmailNotice>;
  let component: VerifyEmailNotice;
  let httpMock: HttpTestingController;

  const setup = (user: AuthUser | null) => {
    if (user) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(user));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VerifyEmailNotice);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('when it shows', () => {
    it('prompts a signed-in user whose address is unverified', () => {
      setup(UNVERIFIED);

      expect(component.visible()).toBe(true);
      expect(text()).toContain('not verified yet');
    });

    it('stays hidden for a verified user', () => {
      setup(VERIFIED);

      expect(component.visible()).toBe(false);
      expect(text()).toBe('');
    });

    it('stays hidden while the backend has verification turned off', () => {
      setup(VERIFICATION_OFF);

      expect(component.visible()).toBe(false);
      expect(text()).toBe('');
    });

    it('stays hidden for a session stored before must_verify_email existed', () => {
      const { must_verify_email: _, ...legacy } = UNVERIFIED;
      setup(legacy as AuthUser);

      expect(component.visible()).toBe(false);
    });

    it('stays hidden for a visitor who is not signed in', () => {
      setup(null);

      expect(component.visible()).toBe(false);
      expect(text()).toBe('');
    });
  });

  describe('resending', () => {
    it('confirms when the e-mail went out', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .flush({ message: 'Verification e-mail sent.' }, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();

      expect(component.state()).toBe('sent');
      expect(text()).toContain('Check your inbox');
    });

    it('hides the button once sent, so it is not hammered', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock.expectOne(url).flush({ message: 'sent' }, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    });

    it('explains a 409, which means it was verified in the meantime', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .flush(
          { message: 'Email address is already verified.' },
          { status: 409, statusText: 'Conflict' },
        );

      expect(component.message()).toBe('That address is already verified. Reload the page.');
    });

    it('turns a Retry-After header into a wait in minutes', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .flush(
          { message: 'Too Many Attempts.' },
          { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '300' } },
        );

      expect(component.message()).toBe('Please wait 5 minute(s) before asking again.');
    });

    it('falls back when a 429 carries no Retry-After', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .flush({ message: 'Too Many Attempts.' }, { status: 429, statusText: 'Too Many Requests' });

      expect(component.message()).toBe(
        'You have asked for too many e-mails. Please try again later.',
      );
    });

    it('explains an unreachable server', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });

      expect(component.message()).toBe(
        'Could not reach the server. Check your connection and try again.',
      );
    });

    it('keeps the button available after a failure, so it can be retried', () => {
      setup(UNVERIFIED);

      component.resend();
      httpMock
        .expectOne(url)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(component.state()).toBe('error');
      expect((fixture.nativeElement as HTMLElement).querySelector('button')).not.toBeNull();
    });
  });
});
