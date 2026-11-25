import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Header],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  emailError(): string | null {
    const email = this.form.controls.email;

    if (!(email.touched || email.dirty)) {
      return null;
    }

    if (email.hasError('required')) {
      return 'Enter your e-mail address.';
    }

    if (email.hasError('email')) {
      return 'Enter a valid e-mail address.';
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

    this.auth.requestPasswordReset(this.form.controls.email.value.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.formError.set(
          error.status === 0
            ? 'Could not reach the server. Check your connection and try again.'
            : 'We could not send the reset e-mail right now. Please try again later.',
        );
      },
    });
  }
}
