import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { AuthService } from '../../services/auth';

/**
 * Shown whenever the credentials are refused, whatever shape the refusal
 * takes. Deliberately says nothing about which of the two was wrong, so the
 * form cannot be used to find out whether an address has an account.
 */
const CREDENTIALS_REJECTED = 'Those credentials do not match our records.';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Header],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  /** Set when the guard or the interceptor sent the user here. */
  readonly sessionExpired = this.route.snapshot.queryParamMap.has('expired');

  /** Where to go after signing in, as recorded by the route guard. */
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /**
   * Only the "you left this empty" messages live on the fields. Anything the
   * server says about the credentials is reported at form level.
   */
  error(name: string): string | null {
    const control = this.form.get(name);

    if (!control || !(control.touched || control.dirty)) {
      return null;
    }

    const errors: ValidationErrors = control.errors ?? {};

    switch (name) {
      case 'email':
        if (errors['required']) return 'Enter your e-mail address.';
        if (errors['email']) return 'Enter a valid e-mail address.';
        break;
      case 'password':
        if (errors['required']) return 'Enter your password.';
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

    this.submitting.set(true);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl(this.returnUrl ?? '/home');
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.formError.set(this.messageFor(error));
      },
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    // A banned account is the one case worth naming: the user cannot fix it by
    // retyping, so telling them to try again would be a lie.
    //
    // Unreachable today: LoginController checks only the password and never
    // looks at `banned_at`, so a banned account signs in like any other. Kept
    // so the frontend is not the blocker once the backend adds that check.
    if (error.status === 403) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'This account has been banned.';
    }

    if (error.status === 429) {
      return 'Too many sign-in attempts. Please wait a minute and try again.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    // 422 is what wrong credentials actually produce: LoginController throws a
    // ValidationException, so the message arrives under `errors.email`. It is
    // folded into one general message here rather than shown on the field, so
    // the form cannot be used to find out whether an address has an account.
    // 401 is accepted too, in case the endpoint is tightened later.
    if (error.status === 401 || error.status === 422) {
      return CREDENTIALS_REJECTED;
    }

    if (error.status >= 500) {
      return 'Something went wrong while signing you in. Please try again.';
    }

    return CREDENTIALS_REJECTED;
  }
}
