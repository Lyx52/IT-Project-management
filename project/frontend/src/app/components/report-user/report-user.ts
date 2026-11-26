import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../services/posts.service';

@Component({
  selector: 'app-report-user',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './report-user.html',
})
export class ReportUser {
  private readonly posts = inject(PostService);

  @Input({ required: true }) targetUserId!: number;
  @Input({ required: true }) postId!: number;

  readonly isOpen = signal(false);
  readonly reason = signal('');
  readonly isSending = signal(false);
  readonly error = signal('');
  readonly submitted = signal(false);

  submit(): void {
    const reason = this.reason().trim();

    if (reason.length < 5 || reason.length > 500 || this.isSending()) {
      return;
    }

    this.isSending.set(true);
    this.error.set('');

    this.posts.reportUser(this.targetUserId, this.postId, reason).subscribe({
      next: () => {
        this.isSending.set(false);
        this.isOpen.set(false);
        this.reason.set('');
        this.submitted.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.isSending.set(false);
        this.error.set(
          error.status === 409
            ? 'You have already reported this user.'
            : (error.error?.message ?? 'Could not send the report. Please try again.'),
        );
      },
    });
  }
}
