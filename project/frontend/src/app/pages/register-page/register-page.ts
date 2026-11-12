import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Header } from '../../components/header/header';
import { ValidationErrorBody } from '../../models/auth.model';
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
};

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
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  /** Once true the form is replaced by the "check your e-mail" confirmation. */
  readonly registered = signal(false);
  readonly submitting = signal(false);
  /** The address the verification e-mail went to, shown in the confirmation. */
  readonly registeredEmail = signal('');
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
    },
    { validators: passwordsMatch },
  );

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
    }

    return null;
  }

  submit(): void {
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, email, password, passwordConfirmation, termsAccepted } =
      this.form.getRawValue();

    this.submitting.set(true);

    this.auth
      .register({
        username,
        email,
        password,
        password_confirmation: passwordConfirmation,
        terms_accepted: termsAccepted,
        privacy_policy_version: environment.privacyPolicyVersion,
      })
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.registeredEmail.set(user.email);
          this.registered.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          this.handleError(error);
        },
      });
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

      if (control) {
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
