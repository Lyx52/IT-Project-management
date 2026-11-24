import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { AuthService } from '../../services/auth';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('passwordConfirmation')?.value;

  return !confirmation || password === confirmation ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Header],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly email = this.route.snapshot.queryParamMap.get('email')?.trim() ?? '';
  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly submitting = signal(false);
  readonly completed = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      passwordConfirmation: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  error(name: 'password' | 'passwordConfirmation'): string | null {
    const control = this.form.controls[name];

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('required')) {
      return name === 'password' ? 'Enter a new password.' : 'Confirm your new password.';
    }

    if (control.hasError('minlength')) {
      return 'Use at least 8 characters.';
    }

    if (this.form.hasError('passwordMismatch') && name === 'passwordConfirmation') {
      return 'The passwords do not match.';
    }

    return null;
  }

  submit(): void {
    this.formError.set(null);

    if (!this.email || !this.token) {
      this.formError.set('This reset link is incomplete. Request a new one.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, passwordConfirmation } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth
      .resetPassword({
        email: this.email,
        token: this.token,
        password,
        password_confirmation: passwordConfirmation,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.completed.set(true);
        },
        error: (error: HttpErrorResponse) => {
          this.submitting.set(false);
          const messages = error.error?.errors as Record<string, string[]> | undefined;
          this.formError.set(
            messages
              ? Object.values(messages).flat()[0]
              : (error.error?.message ??
                  'The reset link is invalid or has expired. Request a new one.'),
          );
        },
      });
  }
}
