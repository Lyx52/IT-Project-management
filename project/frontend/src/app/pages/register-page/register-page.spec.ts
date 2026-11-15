import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { CaptchaSolver, SolveEvent } from '../../captcha/captcha-solver';
import { PowProblem } from '../../captcha/pow';
import { CaptchaChallenge, DeterminantCaptcha, MathCaptcha } from '../../models/auth.model';
import { RegisterPageComponent } from './register-page';

const VALID_INPUT = {
  username: 'jane_doe',
  email: 'jane@example.com',
  password: 'correct horse',
  passwordConfirmation: 'correct horse',
  termsAccepted: true,
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
  type: 'hash',
  algorithm: 'SHA-256',
  salt: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  challenge: 'a'.repeat(64),
  max_number: 3_000_000,
  expires_in: 300,
};

const NEXT_CHALLENGE: CaptchaChallenge = {
  captcha_id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  type: 'hash',
  algorithm: 'SHA-256',
  salt: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  challenge: 'b'.repeat(64),
  max_number: 3_000_000,
  expires_in: 300,
};

const MATH: MathCaptcha = {
  captcha_id: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
  type: 'math',
  question: 'What is 7 + 5?',
  expires_in: 300,
};

const DETERMINANT: DeterminantCaptcha = {
  captcha_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  type: 'determinant',
  question: 'What is the determinant of this matrix?',
  matrix: [
    [2, 7],
    [3, 4],
  ],
  expires_in: 300,
};

/**
 * Stands in for the Web Worker: each solve() call is a run the test finishes
 * by hand, so no real hashing happens and every state can be reached.
 */
class FakeSolver {
  readonly runs: { problem: PowProblem; events: Subject<SolveEvent> }[] = [];

  solve(problem: PowProblem) {
    const events = new Subject<SolveEvent>();
    this.runs.push({ problem, events });
    return events.asObservable();
  }

  get current() {
    return this.runs[this.runs.length - 1];
  }

  progress(fraction: number) {
    this.current.events.next({ type: 'progress', fraction });
  }

  finish(number: number) {
    this.current.events.next({ type: 'solved', number });
    this.current.events.complete();
  }

  fail() {
    this.current.events.error(new Error('No number matches'));
  }
}

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let component: RegisterPageComponent;
  let httpMock: HttpTestingController;
  let solver: FakeSolver;
  const url = `${environment.apiBaseUrl}/register`;
  const captchaUrl = `${environment.apiBaseUrl}/captcha`;

  beforeEach(() => {
    // Vitest runs spec files without isolation here, so a session left behind
    // by another file would break the "stays signed out" assertion below.
    localStorage.clear();

    solver = new FakeSolver();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CaptchaSolver, useValue: solver },
      ],
    });

    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // The page fetches and solves its first challenge as soon as it opens
    httpMock.expectOne(captchaUrl).flush(CHALLENGE);
    solver.finish(1234567);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    httpMock.verify();
  });

  /** Throws the solved challenge away and starts on NEXT_CHALLENGE, unsolved. */
  const startNextCheck = () => {
    component.newCaptcha();
    httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
  };

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

  describe('security check', () => {
    it('solves the challenge from the server in the background', () => {
      fixture.detectChanges();

      expect(solver.runs[0].problem).toEqual({
        salt: CHALLENGE.salt,
        challenge: CHALLENGE.challenge,
        maxNumber: CHALLENGE.max_number,
      });
      expect(component.captchaStatus()).toBe('solved');
      expect(text()).toContain('Your browser passed the check.');
    });

    it('shows progress while the browser is working', () => {
      startNextCheck();
      solver.progress(0.427);
      fixture.detectChanges();

      expect(component.captchaStatus()).toBe('solving');
      expect(component.captchaPercent()).toBe(42);
      expect(text()).toContain('Checking your browser...');
      expect(text()).toContain('42%');
    });

    it('stops the previous search when a new challenge is started', () => {
      startNextCheck();
      const unfinished = solver.current.events;

      startNextCheck();

      expect(unfinished.observed).toBe(false);
    });

    it('waits for the check to finish, then sends the form by itself', () => {
      startNextCheck();
      component.form.patchValue(VALID_INPUT);

      component.submit();
      fixture.detectChanges();

      httpMock.expectNone(url);
      expect(component.awaitingCaptcha()).toBe(true);
      expect(text()).toContain('Finishing the security check...');

      solver.finish(77);

      const request = httpMock.expectOne(url);
      expect(request.request.body.captcha_id).toBe(NEXT_CHALLENGE.captcha_id);
      expect(request.request.body.captcha_answer).toBe('77');
      expect(component.awaitingCaptcha()).toBe(false);
      request.flush({ data: CREATED_USER });
    });

    it('fetches a fresh challenge when the solved one is about to expire', () => {
      const later = Date.now() + (CHALLENGE.expires_in - 10) * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(later);
      component.form.patchValue(VALID_INPUT);

      component.submit();

      httpMock.expectNone(url);
      httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
      solver.finish(5);

      expect(httpMock.expectOne(url).request.body.captcha_id).toBe(NEXT_CHALLENGE.captcha_id);
    });

    it('explains when no challenge could be loaded and offers to try again', () => {
      component.newCaptcha();
      httpMock
        .expectOne(captchaUrl)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      expect(component.captchaStatus()).toBe('error');
      expect(text()).toContain('The security check could not be completed.');
      expect(text()).toContain('Try again');
    });

    it('explains a 429 when asking for new challenges too often', () => {
      component.newCaptcha();
      httpMock
        .expectOne(captchaUrl)
        .flush({ message: 'Too Many Attempts.' }, { status: 429, statusText: 'Too Many Requests' });

      expect(component.captchaError()).toBe(
        'Too many security checks. Please wait a minute and try again.',
      );
    });

    it('reports a search that found nothing', () => {
      startNextCheck();
      solver.fail();

      expect(component.captchaStatus()).toBe('error');
      expect(component.captchaError()).toBe('The security check could not be completed.');
    });

    it('runs the check again when the form is sent after it failed', () => {
      startNextCheck();
      solver.fail();
      component.form.patchValue(VALID_INPUT);

      component.submit();

      httpMock.expectOne(captchaUrl).flush(CHALLENGE);
      solver.finish(9);
      httpMock.expectOne(url).flush({ data: CREATED_USER });

      expect(component.registeredUser()).toEqual(CREATED_USER);
    });

    it('gives up on sending, with a message, when the check fails while waiting', () => {
      startNextCheck();
      component.form.patchValue(VALID_INPUT);
      component.submit();

      solver.fail();

      httpMock.expectNone(url);
      expect(component.submitting()).toBe(false);
      expect(component.awaitingCaptcha()).toBe(false);
      expect(component.formError()).toBe('The security check could not be completed.');
    });
  });

  describe('typed-in questions (CAPTCHA_TYPE math or determinant)', () => {
    /** The server switched type: the next challenge is a question. */
    const switchTo = (challenge: CaptchaChallenge) => {
      component.newCaptcha();
      httpMock.expectOne(captchaUrl).flush(challenge);
      fixture.detectChanges();
    };

    it('shows a math question with an answer field, and no background check', () => {
      switchTo(MATH);

      expect(component.captchaStatus()).toBe('ready');
      expect(component.form.controls.captchaAnswer.enabled).toBe(true);
      expect(text()).toContain('What is 7 + 5?');
      expect(text()).not.toContain('Checking your browser');
      expect(solver.runs.length).toBe(1);
    });

    it('shows a determinant as a 2×2 matrix', () => {
      switchTo(DETERMINANT);

      const matrix = (fixture.nativeElement as HTMLElement).querySelector('.matrix')!;
      expect(matrix.getAttribute('aria-label')).toBe('matrix with rows 2 7 and 3 4');
      expect(matrix.textContent!.replace(/\s+/g, '')).toBe('2734');
      expect(text()).toContain('a·d − b·c');
    });

    it('requires an answer and accepts only whole numbers', () => {
      switchTo(MATH);
      component.form.patchValue(VALID_INPUT);

      component.submit();

      httpMock.expectNone(url);
      expect(component.error('captchaAnswer')).toBe('Answer the question.');

      type('captchaAnswer', 'twelve');
      expect(component.error('captchaAnswer')).toBe('Enter the answer as a whole number.');
    });

    it('sends the typed answer, trimmed', () => {
      switchTo(MATH);
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: ' 12 ' });

      component.submit();

      const request = httpMock.expectOne(url);
      expect(request.request.body.captcha_id).toBe(MATH.captcha_id);
      expect(request.request.body.captcha_answer).toBe('12');
      request.flush({ data: CREATED_USER });
    });

    it('accepts a negative determinant', () => {
      switchTo(DETERMINANT);
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: '-13' });

      component.submit();

      expect(httpMock.expectOne(url).request.body.captcha_answer).toBe('-13');
    });

    it('puts a wrong answer on the field, with a new question and an empty answer', () => {
      switchTo(MATH);
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: '13' });
      component.submit();

      httpMock
        .expectOne(url)
        .flush(
          {
            message: 'The given data was invalid.',
            errors: { captcha_answer: ['That answer is not correct. Try the new question.'] },
          },
          { status: 422, statusText: 'Unprocessable Content' },
        );
      httpMock.expectOne(captchaUrl).flush(DETERMINANT);
      fixture.detectChanges();

      expect(component.error('captchaAnswer')).toBe(
        'That answer is not correct. Try the new question.',
      );
      expect(component.form.controls.captchaAnswer.value).toBe('');
      expect(component.matrix()).toEqual(DETERMINANT.matrix);

      type('captchaAnswer', '-13');
      expect(component.error('captchaAnswer')).toBeNull();
    });

    it('clears the old answer when a new question is asked for', () => {
      switchTo(MATH);
      type('captchaAnswer', '12');

      switchTo(DETERMINANT);

      expect(component.form.controls.captchaAnswer.value).toBe('');
      // Reset to pristine, so the empty field is not flagged straight away
      expect(component.error('captchaAnswer')).toBeNull();
    });

    it('does not submit while the question is loading or failed to load', () => {
      switchTo(MATH);
      component.form.patchValue({ ...VALID_INPUT, captchaAnswer: '12' });

      component.newCaptcha();
      component.form.controls.captchaAnswer.setValue('12');
      component.submit();

      httpMock.expectNone(url);
      expect(component.formError()).toBe(
        'The security question has not loaded yet. Please try again.',
      );

      httpMock
        .expectOne(captchaUrl)
        .flush({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      expect(text()).toContain('Could not load the security question.');
    });

    it('hides the answer field again when the server switches back to hash', () => {
      switchTo(MATH);

      switchTo(NEXT_CHALLENGE);

      expect(component.form.controls.captchaAnswer.disabled).toBe(true);
      expect(component.captchaStatus()).toBe('solving');
      expect(text()).not.toContain('Security question');
    });

    it('stops waiting for a hash puzzle when a question arrives instead', () => {
      startNextCheck();
      component.form.patchValue(VALID_INPUT);
      component.submit();
      expect(component.awaitingCaptcha()).toBe(true);

      switchTo(MATH);

      httpMock.expectNone(url);
      expect(component.submitting()).toBe(false);
      expect(component.formError()).toBe('Answer the security question, then send the form again.');
    });
  });

  describe('submitting', () => {
    it('sends the backend field names, the consent flag, the policy version and the solved check', () => {
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
        captcha_id: CHALLENGE.captcha_id,
        captcha_answer: '1234567',
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
     * submission is followed by a new challenge, which the browser starts on.
     */
    const expectNewChallenge = () => {
      httpMock.expectOne(captchaUrl).flush(NEXT_CHALLENGE);
      expect(solver.current.problem.salt).toBe(NEXT_CHALLENGE.salt);
      expect(component.captchaStatus()).toBe('solving');
    };

    const flush422 = (errors: Record<string, string[]>) => {
      submitValid().flush(
        { message: 'The given data was invalid.', errors },
        { status: 422, statusText: 'Unprocessable Content' },
      );
      expectNewChallenge();
    };

    it('reports a rejected check at form level and starts a new one', () => {
      flush422({ captcha_answer: ['The security check failed. Please try again.'] });

      expect(component.formError()).toBe('The security check failed. Please try again.');
      expect(component.registeredUser()).toBeNull();
    });

    it('can send again once the new check is done', () => {
      flush422({ email: ['The email has already been taken.'] });
      component.form.controls.email.setValue('someone.else@example.com');
      solver.finish(42);

      component.submit();

      const request = httpMock.expectOne(url);
      expect(request.request.body.captcha_id).toBe(NEXT_CHALLENGE.captcha_id);
      expect(request.request.body.captcha_answer).toBe('42');
      request.flush({ data: CREATED_USER });
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
