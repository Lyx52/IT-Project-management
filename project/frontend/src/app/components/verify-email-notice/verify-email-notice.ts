import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth';

type ResendState = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-verify-email-notice',
  imports: [],
  templateUrl: './verify-email-notice.html',
  styleUrl: './verify-email-notice.scss',
})
export class VerifyEmailNotice {
  private readonly auth = inject(AuthService);

  readonly state = signal<ResendState>('idle');
  readonly message = signal<string | null>(null);

  /**
   * Only shown to a signed-in user who has to confirm their address before
   * posting. Posting is refused server-side until then, so this is the one
   * prompt that stops someone writing a whole report before finding out.
   * Never shown while the backend has verification turned off.
   */
  readonly visible = computed(() => this.auth.isAuthenticated() && this.auth.mustVerifyEmail());

  resend(): void {
    this.state.set('sending');
    this.message.set(null);

    this.auth.resendVerification().subscribe({
      next: () => {
        this.state.set('sent');
        this.message.set('Verification e-mail sent. Check your inbox.');
      },
      error: (error: HttpErrorResponse) => {
        this.state.set('error');
        this.message.set(this.messageFor(error));
      },
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    // The address was confirmed in the meantime, maybe in another tab.
    if (error.status === 409) {
      return 'That address is already verified. Reload the page.';
    }

    // Resend is rate limited per user, per day and per IP, and each call costs
    // a real e-mail, so this is expected rather than exceptional.
    if (error.status === 429) {
      const retryAfter = Number(error.headers?.get('Retry-After'));

      return Number.isFinite(retryAfter) && retryAfter > 0
        ? `Please wait ${Math.ceil(retryAfter / 60)} minute(s) before asking again.`
        : 'You have asked for too many e-mails. Please try again later.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Could not send the e-mail. Please try again.';
  }
}
