import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { RegisterPageComponent } from './register-page';

const VALID_INPUT = {
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse',
  passwordConfirmation: 'correct horse',
  termsAccepted: true,
};

const CREATED_USER = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
};

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let component: RegisterPageComponent;
  let httpMock: HttpTestingController;
  const url = `${environment.apiBaseUrl}/register`;

  beforeEach(() => {
    // Vitest runs spec files without isolation here, so a session left behind
    // by another file would break the "stays signed out" assertion below.
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Mimics typing. A programmatic setValue leaves the control pristine and
   * untouched, and the component stays quiet about untouched fields on
   * purpose, so the message would never appear.
   */
  const type = (field: string, value: string | boolean) => {
    const control = component.form.get(field)!;
    control.setValue(value);
    control.markAsDirty();
  };

  describe('client-side validation', () => {
    it('sends no request while the form is empty', () => {
      component.submit();

      httpMock.expectNone(url);
      expect(component.error('username')).toBe('Choose a username.');
      expect(component.error('email')).toBe('Enter your e-mail address.');
    });

    it('rejects a username with characters the backend regex forbids', () => {
      type('username', 'jane doe!');

      expect(component.form.controls.username.valid).toBe(false);
      expect(component.error('username')).toBe(
        'Use only letters, numbers, underscores and hyphens.',
      );
    });

    it('rejects a username shorter than 3 characters', () => {
      type('username', 'ab');

      expect(component.error('username')).toBe('Username must be 3 to 30 characters.');
    });

    it('rejects a password shorter than 8 characters', () => {
      type('password', 'short');

      expect(component.error('password')).toBe('Password must be at least 8 characters.');
    });

    it('reports a mismatch on the confirmation field', () => {
      type('password', 'correct horse');
      type('passwordConfirmation', 'correct hors');

      expect(component.form.hasError('passwordMismatch')).toBe(true);
      expect(component.error('passwordConfirmation')).toBe('Passwords do not match.');
    });

    it('stays quiet about a field the user has not touched', () => {
      component.form.controls.username.setValue('ab');

      expect(component.form.controls.username.valid).toBe(false);
      expect(component.error('username')).toBeNull();
    });

    it('blocks submission until the terms are accepted', () => {
      component.form.patchValue({ ...VALID_INPUT, termsAccepted: false });

      component.submit();

      httpMock.expectNone(url);
      expect(component.error('termsAccepted')).toBe(
        'You must accept the terms and privacy policy.',
      );
    });
  });

  describe('submitting', () => {
    it('sends the backend field names, the consent flag and the policy version', () => {
      component.form.patchValue(VALID_INPUT);

      component.submit();

      const request = httpMock.expectOne(url);

      expect(request.request.body).toEqual({
        username: 'jane_doe',
        email: 'jane@example.com',
        password: 'correct horse',
        password_confirmation: 'correct horse',
        terms_accepted: true,
        privacy_policy_version: environment.privacyPolicyVersion,
      });

      request.flush({ data: CREATED_USER });
    });

    it('shows the check-your-e-mail confirmation and leaves the user signed out', () => {
      component.form.patchValue(VALID_INPUT);
      component.submit();
      httpMock.expectOne(url).flush({ data: CREATED_USER });
      fixture.detectChanges();

      expect(component.registered()).toBe(true);
      expect(component.registeredEmail()).toBe('jane@example.com');
      expect(component.submitting()).toBe(false);

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Check your e-mail');
      expect(text).toContain('jane@example.com');
      expect(text).toContain('not signed in');

      // Nothing was issued or persisted: the endpoint returns no token.
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('server errors', () => {
    const submitValid = () => {
      component.form.patchValue(VALID_INPUT);
      component.submit();
      return httpMock.expectOne(url);
    };

    const flush422 = (errors: Record<string, string[]>) =>
      submitValid().flush(
        { message: 'The given data was invalid.', errors },
        { status: 422, statusText: 'Unprocessable Content' },
      );

    it('shows a duplicate e-mail message on the e-mail field', () => {
      flush422({ email: ['The email has already been taken.'] });

      expect(component.error('email')).toBe('The email has already been taken.');
      expect(component.registered()).toBe(false);
    });

    it('shows a duplicate username message on the username field', () => {
      flush422({ username: ['The username has already been taken.'] });

      expect(component.error('username')).toBe('The username has already been taken.');
    });

    it('shows a weak-password message on the password field', () => {
      flush422({ password: ['The password field must be at least 8 characters.'] });

      expect(component.error('password')).toBe('The password field must be at least 8 characters.');
    });

    it('maps password_confirmation onto the confirmation control', () => {
      flush422({ password_confirmation: ['The password confirmation does not match.'] });

      expect(component.error('passwordConfirmation')).toBe(
        'The password confirmation does not match.',
      );
    });

    it('raises fields the form has no control for to the form-level message', () => {
      flush422({ privacy_policy_version: ['The selected privacy policy version is invalid.'] });

      expect(component.formError()).toBe('The selected privacy policy version is invalid.');
    });

    it('drops a server error once the field is edited', () => {
      flush422({ email: ['The email has already been taken.'] });
      expect(component.error('email')).toBe('The email has already been taken.');

      component.form.controls.email.setValue('someone.else@example.com');

      expect(component.error('email')).toBeNull();
      expect(component.form.valid).toBe(true);
    });

    it('explains a 429 from the throttle at form level', () => {
      submitValid().flush(
        { message: 'Too Many Attempts.' },
        { status: 429, statusText: 'Too Many Requests' },
      );

      expect(component.formError()).toBe(
        'Too many sign-up attempts. Please wait a minute and try again.',
      );
      expect(component.submitting()).toBe(false);
    });

    it('explains an unreachable server', () => {
      submitValid().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.formError()).toBe(
        'Could not reach the server. Check your connection and try again.',
      );
    });

    it('falls back to a generic message for a 500', () => {
      submitValid().flush(
        { message: 'Server Error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(component.formError()).toBe(
        'Something went wrong while creating your account. Please try again.',
      );
    });
  });
});
