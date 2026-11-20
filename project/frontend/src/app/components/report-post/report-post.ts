import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-report-post',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './report-post.html',
  styleUrl: './report-post.scss',
})
export class ReportPost {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly postId = input.required<number>();

  readonly isOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly isReported = signal(false);

  readonly isAuthenticated = this.auth.isAuthenticated;

  /**
   * A reason is required: it is what the moderator acts on. The 5-character
   * minimum mirrors ReportPostRequest, so a too-short reason is caught here
   * instead of coming back as a server error.
   */
  readonly form = this.fb.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  readonly reasonError = computed(() => {
    const control = this.form.controls.reason;

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Please say what is wrong with this post.';
    }

    if (control.hasError('minlength')) {
      return 'Please give at least 5 characters, so a moderator can act on it.';
    }

    if (control.hasError('maxlength')) {
      return 'Please keep it under 500 characters.';
    }

    return null;
  });

  open(): void {
    this.submitError.set(null);
    this.form.reset({ reason: '' });
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.http
      .post(`${environment.apiBaseUrl}/post/${this.postId()}/report`, this.form.getRawValue())
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isReported.set(true);
          this.isOpen.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting.set(false);

          // One report per person per post, enforced by a unique index and by
          // the controller regardless of whether the first report is still
          // open. This used to close the modal and show "Reported", which read
          // as success even though nothing was created.
          if (error.status === 409) {
            this.isReported.set(true);
          }

          this.submitError.set(this.messageFor(error));
        },
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return this.serverMessage(error) ?? 'You have already reported this post.';
    }

    if (error.status === 422) {
      // The server says exactly what is wrong ("at least 5 characters"), which
      // is far more use than a generic "check the reason and try again".
      return this.serverMessage(error) ?? 'Please check the reason and try again.';
    }

    if (error.status === 403) {
      return this.serverMessage(error) ?? 'This account is not allowed to report posts.';
    }

    if (error.status === 404) {
      return 'This post is no longer available.';
    }

    if (error.status === 429) {
      return 'Too many reports just now. Please wait a minute and try again.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Could not send the report. Please try again.';
  }

  /** The field error if there is one, otherwise the top-level message. */
  private serverMessage(error: HttpErrorResponse): string | null {
    const fieldError = error.error?.errors?.reason?.[0];

    if (typeof fieldError === 'string') {
      return fieldError;
    }

    return typeof error.error?.message === 'string' ? error.error.message : null;
  }
}
