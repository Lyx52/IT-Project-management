import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { PostImageStrip } from '../post-image-strip/post-image-strip';
import { ModerationReport } from '../../models/admin.model';

@Component({
  selector: 'app-admin-reports',
  imports: [DatePipe, PostImageStrip],
  templateUrl: './admin-reports.html',
  styleUrl: './admin-reports.scss',
})
export class AdminReports {
  private readonly admin = inject(AdminService);

  readonly reports = input<ModerationReport[]>([]);
  readonly changed = output<void>();

  readonly busyId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly isEmpty = computed(() => this.reports().length === 0);

  /**
   * Hides the reported post and closes the report, so a handled report leaves
   * the queue. Closing on its own would leave the post public.
   */
  hidePost(report: ModerationReport): void {
    if (!report.post) {
      return;
    }

    this.run(report.id, this.admin.takedownPost(report.post.id), report.id);
  }

  /**
   * Bans the author. The backend revokes their tokens, so they are signed out
   * immediately, and their posts stop being publicly visible.
   */
  banAuthor(report: ModerationReport): void {
    if (!report.post) {
      return;
    }

    this.run(report.id, this.admin.banUser(report.post.user.id), report.id);
  }

  /** Leaves the post alone: the report was unfounded. */
  dismiss(report: ModerationReport): void {
    this.run(report.id, this.admin.closeReport(report.id));
  }

  /**
   * Runs an action, then closes the report when `closeAfter` is given, so one
   * click both acts on the post and clears the queue entry.
   */
  private run(reportId: number, request: Observable<unknown>, closeAfter?: number): void {
    this.busyId.set(reportId);
    this.actionError.set(null);

    request.subscribe({
      next: () => {
        if (closeAfter === undefined) {
          this.finish();
          return;
        }

        this.admin.closeReport(closeAfter).subscribe({
          next: () => this.finish(),
          error: (error: HttpErrorResponse) => this.fail(error),
        });
      },
      error: (error: HttpErrorResponse) => this.fail(error),
    });
  }

  private finish(): void {
    this.busyId.set(null);
    this.changed.emit();
  }

  private fail(error: HttpErrorResponse): void {
    this.busyId.set(null);
    this.actionError.set(this.messageFor(error));
    // Another admin may have handled it already, so reload regardless.
    this.changed.emit();
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 422) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'That report has already been handled.';
    }

    if (error.status === 403) {
      return 'Your account is not allowed to moderate posts.';
    }

    if (error.status === 404) {
      return 'That post or report no longer exists.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Something went wrong. Please try again.';
  }
}
