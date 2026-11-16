import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subscription, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CaptchaSolver } from '../../captcha/captcha-solver';
import { Header } from '../../components/header/header';
import {
  AuthUser,
  CaptchaChallenge,
  CaptchaType,
  ValidationErrorBody,
} from '../../models/auth.model';
import { AuthService } from '../../services/auth';

/**
 * Backend field name -> form control name. The backend reports errors under
 * its own snake_case names, and `privacy_policy_version` is deliberately
 * absent because the form has no field for it.
 */
const SERVER_FIELD_TO_CONTROL: Record<string, string> = {
  username: 'username',
  email: 'email',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
  terms_accepted: 'termsAccepted',
  captcha_answer: 'captchaAnswer',
};

/**
 * A solved hash puzzle is thrown away this long before the server would
 * expire it, so a slow request cannot arrive just too late.
 */
const CAPTCHA_EXPIRY_MARGIN_MS = 15_000;

/**
 * loading: fetching a challenge
 * ready:   a question (math, determinant) is shown for the user to answer
 * solving: the browser is working on a hash puzzle
 * solved:  the hash puzzle is done
 * error:   no challenge could be loaded, or the puzzle could not be solved
 */
type CaptchaStatus = 'loading' | 'ready' | 'solving' | 'solved' | 'error';

interface CaptchaSolution {
  captchaId: string;
  answer: string;
  /** Date.now() after which the server no longer accepts it. */
  expiresAt: number;
}

/**
 * Checked on the group because it compares two controls. An empty
 * confirmation is left to its own `required` validator, so the user is not
 * told the passwords differ before they have typed anything.
 */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('passwordConfirmation')?.value;

  if (!confirmation) {
    return null;
  }

  return password === confirmation ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Header],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly solver = inject(CaptchaSolver);
  private readonly fb = inject(FormBuilder);

  /** Set once the account exists; the form is then replaced by a confirmation. */
  readonly registeredUser = signal<AuthUser | null>(null);
  readonly submitting = signal(false);

  /**
   * The CAPTCHA, of whichever type the server's CAPTCHA_TYPE picks. math and
   * determinant show a question the user answers in `captchaAnswer`; hash is
   * solved in the background as soon as the page opens, so it is usually
   * done before the form is filled in.
   */
  readonly captcha = signal<CaptchaChallenge | null>(null);
  /** Type of the latest challenge. Kept while the next one loads. */
  readonly captchaType = signal<CaptchaType | null>(null);
  /** Whether the user types the answer, rather than the browser finding it. */
  readonly asksUser = computed(() => {
    const type = this.captchaType();
    return type === 'math' || type === 'determinant';
  });
  /** The 2×2 matrix of a determinant question, else null. */
  readonly matrix = computed(() => {
    const challenge = this.captcha();
    return challenge?.type === 'determinant' ? challenge.matrix : null;
  });
  readonly captchaStatus = signal<CaptchaStatus>('loading');
  /** Hash puzzle only: share of the search range covered so far, 0 to 1. */
  readonly captchaProgress = signal(0);
  readonly captchaPercent = computed(() => Math.floor(this.captchaProgress() * 100));
  /** Why no challenge could be loaded or solved, shown in its place. */
  readonly captchaError = signal<string | null>(null);
  /**
   * Hash puzzle only: "Create account" was pressed before the browser
   * finished. The form is sent as soon as it does.
   */
  readonly awaitingCaptcha = signal(false);
  /** An error that belongs to no single field: throttling, network, 5xx. */
  readonly formError = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  /**
   * Mirrors the backend rules in RegisterRequest so the obvious mistakes are
   * caught before a request is spent against the 5-per-minute throttle. The
   * server stays the authority: whatever it rejects is shown on the field.
   */
  readonly form = this.fb.nonNullable.group(
    {
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9_-]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      passwordConfirmation: ['', [Validators.required]],
      termsAccepted: [false, [Validators.requiredTrue]],
      // Only for typed-in answers: disabled, and so not validated, while the
      // CAPTCHA is a hash puzzle. Determinants can be negative.
      captchaAnswer: [
        { value: '', disabled: true },
        [Validators.required, Validators.pattern(/^\s*-?\d+\s*$/)],
      ],
    },
    { validators: passwordsMatch },
  );

  /** The solved hash puzzle, until it is sent or expires. */
  private solution: CaptchaSolution | null = null;
  private captchaSubscription?: Subscription;

  constructor() {
    // Unsubscribing stops the worker, so leaving the page stops the work
    inject(DestroyRef).onDestroy(() => this.captchaSubscription?.unsubscribe());
  }

  ngOnInit(): void {
    this.loadCaptcha();
  }

  /** "New question" and "Try again": a fresh challenge and an empty answer field. */
  newCaptcha(): void {
    this.form.controls.captchaAnswer.reset('');
    this.loadCaptcha();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /**
   * The message to show under a field, or null to show nothing. Stays quiet
   * until the field has been touched or edited so a pristine form is not a
   * wall of red.
   */
  error(name: string): string | null {
    const control = this.form.get(name);

    if (!control || !(control.touched || control.dirty)) {
      return null;
    }

    const errors: ValidationErrors = control.errors ?? {};

    // A message from the server wins: it is the authority on this value.
    if (typeof errors['server'] === 'string') {
      return errors['server'];
    }

    switch (name) {
      case 'username':
        if (errors['required']) return 'Choose a username.';
        if (errors['minlength'] || errors['maxlength'])
          return 'Username must be 3 to 30 characters.';
        if (errors['pattern']) return 'Use only letters, numbers, underscores and hyphens.';
        break;
      case 'email':
        if (errors['required']) return 'Enter your e-mail address.';
        if (errors['email']) return 'Enter a valid e-mail address.';
        break;
      case 'password':
        if (errors['required']) return 'Choose a password.';
        if (errors['minlength']) return 'Password must be at least 8 characters.';
        break;
      case 'passwordConfirmation':
        if (errors['required']) return 'Repeat your password.';
        if (this.form.hasError('passwordMismatch')) return 'Passwords do not match.';
        break;
      case 'termsAccepted':
        if (errors['required']) return 'You must accept the terms and privacy policy.';
        break;
      case 'captchaAnswer':
        if (errors['required']) return 'Answer the question.';
        if (errors['pattern']) return 'Enter the answer as a whole number.';
        break;
    }

    return null;
  }

  submit(): void {
    this.formError.set(null);

    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.asksUser()) {
      this.submitTypedAnswer();
    } else {
      this.submitSolvedPuzzle();
    }
  }

  /** math and determinant: send the question's id with what the user typed. */
  private submitTypedAnswer(): void {
    const challenge = this.captcha();

    if (!challenge || challenge.type === 'hash') {
      this.formError.set('The security question has not loaded yet. Please try again.');
      return;
    }

    this.submitting.set(true);
    this.send(challenge.captcha_id, this.form.controls.captchaAnswer.value.trim());
  }

  /** hash: send the browser's solution, or wait for it. */
  private submitSolvedPuzzle(): void {
    this.submitting.set(true);

    if (this.solution && Date.now() < this.solution.expiresAt - CAPTCHA_EXPIRY_MARGIN_MS) {
      this.send(this.solution.captchaId, this.solution.answer);
      return;
    }

    // Still working, failed, or solved so long ago that it has expired: send
    // once a fresh puzzle is solved
    this.awaitingCaptcha.set(true);

    if (this.captchaStatus() === 'solved' || this.captchaStatus() === 'error') {
      this.loadCaptcha();
    }
  }

  private send(captchaId: string, answer: string): void {
    // The server uses a challenge up on every attempt, right or wrong
    this.solution = null;

    const { username, email, password, passwordConfirmation, termsAccepted } =
      this.form.getRawValue();

    this.auth
      .register({
        username,
        email,
        password,
        password_confirmation: passwordConfirmation,
        terms_accepted: termsAccepted,
        privacy_policy_version: environment.privacyPolicyVersion,
        captcha_id: captchaId,
        captcha_answer: answer,
      })
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.registeredUser.set(user);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);

          // The old question cannot be answered again. Clear its answer
          // before handleError, which may put the server's message on it.
          this.form.controls.captchaAnswer.reset('');
          this.handleError(error);
          // A hash puzzle starts on the next one right away, so a corrected
          // form can be sent again without waiting
          this.loadCaptcha();
        },
      });
  }

  /** Fetches a new challenge; a hash puzzle is then solved in a Web Worker. */
  private loadCaptcha(): void {
    // Stops a search still running for the previous challenge
    this.captchaSubscription?.unsubscribe();
    this.solution = null;
    this.captcha.set(null);
    this.captchaStatus.set('loading');
    this.captchaProgress.set(0);
    this.captchaError.set(null);

    this.captchaSubscription = this.auth
      .captcha()
      .pipe(
        switchMap((challenge) => {
          this.captcha.set(challenge);
          this.useCaptchaType(challenge.type);

          if (challenge.type !== 'hash') {
            this.captchaStatus.set('ready');
            return EMPTY;
          }

          // Counted from the response, so slightly before the server's expiry
          const expiresAt = Date.now() + challenge.expires_in * 1000;
          this.captchaStatus.set('solving');

          return this.solver
            .solve({
              salt: challenge.salt,
              challenge: challenge.challenge,
              maxNumber: challenge.max_number,
            })
            .pipe(map((event) => ({ event, captchaId: challenge.captcha_id, expiresAt })));
        }),
      )
      .subscribe({
        next: ({ event, captchaId, expiresAt }) => {
          if (event.type === 'progress') {
            this.captchaProgress.set(event.fraction);
            return;
          }

          this.solution = { captchaId, answer: String(event.number), expiresAt };
          this.captchaProgress.set(1);
          this.captchaStatus.set('solved');

          if (this.awaitingCaptcha()) {
            this.awaitingCaptcha.set(false);
            this.send(this.solution.captchaId, this.solution.answer);
          }
        },
        error: (error: unknown) => {
          this.captchaStatus.set('error');
          this.captchaError.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? 'Too many security checks. Please wait a minute and try again.'
              : this.asksUser()
                ? 'Could not load the security question.'
                : 'The security check could not be completed.',
          );

          if (this.awaitingCaptcha()) {
            this.awaitingCaptcha.set(false);
            this.submitting.set(false);
            this.formError.set(this.captchaError());
          }
        },
      });
  }

  /**
   * Shows or hides the answer field to match the challenge. Only touches the
   * control when the type actually changes: enabling or disabling re-runs its
   * validators and would drop a message from the server.
   */
  private useCaptchaType(type: CaptchaType): void {
    this.captchaType.set(type);
    const answer = this.form.controls.captchaAnswer;

    if (type === 'hash' && answer.enabled) {
      answer.disable();
    } else if (type !== 'hash' && answer.disabled) {
      answer.enable();
    }

    // Was waiting for a hash puzzle, but the server switched to questions
    if (type !== 'hash' && this.awaitingCaptcha()) {
      this.awaitingCaptcha.set(false);
      this.submitting.set(false);
      this.formError.set('Answer the security question, then send the form again.');
    }
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 422) {
      this.applyServerFieldErrors(error.error as ValidationErrorBody | null);
      return;
    }

    if (error.status === 429) {
      this.formError.set('Too many sign-up attempts. Please wait a minute and try again.');
      return;
    }

    if (error.status === 0) {
      this.formError.set('Could not reach the server. Check your connection and try again.');
      return;
    }

    this.formError.set('Something went wrong while creating your account. Please try again.');
  }

  /**
   * Puts each rejected field's first message on its control as a `server`
   * error. Angular re-runs the validators on the next edit, which drops these
   * on its own, so a stale message cannot outlive the value it describes.
   */
  private applyServerFieldErrors(body: ValidationErrorBody | null): void {
    const errors = body?.errors ?? {};
    const unmatched: string[] = [];

    for (const [field, messages] of Object.entries(errors)) {
      const message = messages?.[0];

      if (!message) {
        continue;
      }

      const controlName = SERVER_FIELD_TO_CONTROL[field];
      const control = controlName ? this.form.get(controlName) : null;

      // A disabled control is not on screen, e.g. the answer field while the
      // CAPTCHA is a hash puzzle
      if (control?.enabled) {
        control.setErrors({ ...(control.errors ?? {}), server: message });
        control.markAsTouched();
      } else {
        // Has no field in the form, e.g. privacy_policy_version.
        unmatched.push(message);
      }
    }

    this.formError.set(
      unmatched.length > 0 ? unmatched.join(' ') : 'Please correct the highlighted fields.',
    );
  }
}
