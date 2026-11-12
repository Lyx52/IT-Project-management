import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { CaptchaChallenge } from '../../models/auth.model';
import { RegisterPageComponent } from './register-page';

const VALID_INPUT = {
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse',
  passwordConfirmation: 'correct horse',
  termsAccepted: true,
  captchaAnswer: '12',
};

/** Verification turned off on the backend: the account can sign in right away. */
const CREATED_USER = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: false,
};

const CHALLENGE: CaptchaChallenge = {
  captcha_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  question: 'What is 7 + 5?',
  expires_in: 300,
};

const NEXT_CHALLENGE: CaptchaChallenge = {
  captcha_id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  question: 'What is 15 − 4?',
  expires_in: 300,
};

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let component: RegisterPageComponent;
  let httpMock: HttpTestingController;
  const url = `${environment.apiBaseUrl}/register`;
  const captchaUrl = `${environment.apiBaseUrl}/captcha`;

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

    // The page asks for its first question as soon as it opens
    httpMock.expectOne(captchaUrl).flush(CHALLENGE);
  });

  afterEach(() => {
    httpMock.verify();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

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
      expect(component.error('captchaAnswer')).toBe('Answer the question.');
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

    it('blocks submission until the question is answered', () => {
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: '' });

      component.submit();

      httpMock.expectNone(url);
      expect(component.error('captchaAnswer')).toBe('Answer the question.');
    });

    it('rejects an answer that is not a whole number', () => {
      type('captchaAnswer', 'twelve');

      expect(component.error('captchaAnswer')).toBe('Enter the answer as a number.');
    });
  });

  describe('security question', () => {
    it('shows the question from the server', () => {
      fixture.detectChanges();

      expect(component.captcha()).toEqual(CHALLENGE);
      expect(text()).toContain('What is 7 + 5?');
    });

    it('fetches a new question on request and clears the old answer', () => {
      type('captchaAnswer', '12');

      component.newCaptcha();
      httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
      fixture.detectChanges();

      expect(component.captcha()).toEqual(NEXT_CHALLENGE);
      expect(component.form.controls.captchaAnswer.value).toBe('');
      // Reset to pristine, so the empty field is not flagged straight away
      expect(component.error('captchaAnswer')).toBeNull();
      expect(text()).toContain('What is 15 − 4?');
    });

    it('explains when no question could be loaded and does not submit', () => {
      component.newCaptcha();
      httpMock
        .expectOne(captchaUrl)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      expect(component.captcha()).toBeNull();
      expect(text()).toContain('Could not load the security question.');

      component.form.patchValue(VALID_INPUT);
      component.submit();

      httpMock.expectNone(url);
      expect(component.formError()).toBe(
        'The security question has not loaded yet. Please try again.',
      );
    });

    it('does not submit the old question while a new one is loading', () => {
      component.form.patchValue(VALID_INPUT);
      component.newCaptcha();
      component.form.controls.captchaAnswer.setValue('12');

      component.submit();

      httpMock.expectNone(url);
      httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
    });

    it('explains a 429 when asking for new questions too often', () => {
      component.newCaptcha();
      httpMock
        .expectOne(captchaUrl)
        .flush({ message: 'Too Many Attempts.' }, { status: 429, statusText: 'Too Many Requests' });

      expect(component.captchaError()).toBe(
        'Too many new questions. Please wait a minute and try again.',
      );
    });
  });

  describe('submitting', () => {
    it('sends the backend field names, the consent flag, the policy version and the answer', () => {
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: ' 12 ' });

      component.submit();

      const request = httpMock.expectOne(url);

      expect(request.request.body).toEqual({
        username: 'jane_doe',
        email: 'jane@example.com',
        password: 'correct horse',
        password_confirmation: 'correct horse',
        terms_accepted: true,
        privacy_policy_version: environment.privacyPolicyVersion,
        captcha_id: CHALLENGE.captcha_id,
        captcha_answer: '12',
      });

      request.flush({ data: CREATED_USER });
    });

    it('says the account is ready when no verification is needed, and leaves the user signed out', () => {
      component.form.patchValue(VALID_INPUT);
      component.submit();
      httpMock.expectOne(url).flush({ data: CREATED_USER });
      fixture.detectChanges();

      expect(component.registeredUser()).toEqual(CREATED_USER);
      expect(component.submitting()).toBe(false);

      expect(text()).toContain('Your account is ready');
      expect(text()).toContain('jane@example.com');
      expect(text()).toContain('not signed in yet');
      expect(text()).not.toContain('Check your e-mail');

      // Nothing was issued or persisted: the endpoint returns no token.
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    it('shows the check-your-e-mail confirmation while verification is on', () => {
      component.form.patchValue(VALID_INPUT);
      component.submit();
      httpMock.expectOne(url).flush({ data: { ...CREATED_USER, must_verify_email: true } });
      fixture.detectChanges();

      expect(text()).toContain('Check your e-mail');
      expect(text()).toContain('jane@example.com');
      expect(text()).toContain('not signed in');
      expect(text()).not.toContain('Your account is ready');
    });
  });

  describe('server errors', () => {
    const submitValid = (): TestRequest => {
      component.form.patchValue(VALID_INPUT);
      component.submit();
      return httpMock.expectOne(url);
    };

    /**
     * The server uses up the challenge on every attempt, so each failed
     * submission is followed by a request for a new one.
     */
    const expectNewChallenge = () => {
      httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
      expect(component.captcha()).toEqual(NEXT_CHALLENGE);
    };

    const flush422 = (errors: Record<string, string[]>) => {
      submitValid().flush(
        { message: 'The given data was invalid.', errors },
        { status: 422, statusText: 'Unprocessable Content' },
      );
      expectNewChallenge();
    };

    it('shows a wrong answer on the question field, with a new question and an empty answer', () => {
      flush422({ captcha_answer: ['That answer is not correct. Try the new question.'] });
      fixture.detectChanges();

      expect(component.error('captchaAnswer')).toBe(
        'That answer is not correct. Try the new question.',
      );
      expect(component.form.controls.captchaAnswer.value).toBe('');
      expect(component.registeredUser()).toBeNull();
      expect(text()).toContain('What is 15 − 4?');
    });

    it('asks for a new answer quietly when another field was the problem', () => {
      flush422({ email: ['The email has already been taken.'] });

      expect(component.error('email')).toBe('The email has already been taken.');
      expect(component.form.controls.captchaAnswer.value).toBe('');
      expect(component.error('captchaAnswer')).toBeNull();
    });

    it('drops the wrong-answer message once a new answer is typed', () => {
      flush422({ captcha_answer: ['That answer is not correct. Try the new question.'] });

      type('captchaAnswer', '11');

      expect(component.error('captchaAnswer')).toBeNull();
    });

    it('shows a duplicate e-mail message on the e-mail field', () => {
      flush422({ email: ['The email has already been taken.'] });

      expect(component.error('email')).toBe('The email has already been taken.');
      expect(component.registeredUser()).toBeNull();
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
      component.form.controls.captchaAnswer.setValue('11');

      expect(component.error('email')).toBeNull();
      expect(component.form.valid).toBe(true);
    });

    it('explains a 429 from the throttle at form level', () => {
      submitValid().flush(
        { message: 'Too Many Attempts.' },
        { status: 429, statusText: 'Too Many Requests' },
      );
      expectNewChallenge();

      expect(component.formError()).toBe(
        'Too many sign-up attempts. Please wait a minute and try again.',
      );
      expect(component.submitting()).toBe(false);
    });

    it('explains an unreachable server', () => {
      submitValid().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      expectNewChallenge();

      expect(component.formError()).toBe(
        'Could not reach the server. Check your connection and try again.',
      );
    });

    it('falls back to a generic message for a 500', () => {
      submitValid().flush(
        { message: 'Server Error' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      expectNewChallenge();

      expect(component.formError()).toBe(
        'Something went wrong while creating your account. Please try again.',
      );
    });
  });
});
