import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { PostImageStrip } from '../post-image-strip/post-image-strip';
import { Item } from '../../models/models';

@Component({
  selector: 'app-admin-pending-posts',
  imports: [DatePipe, PostImageStrip],
  templateUrl: './admin-pending-posts.html',
  styleUrl: './admin-pending-posts.scss',
})
export class AdminPendingPosts {
  private readonly admin = inject(AdminService);

  readonly posts = input<Item[]>([]);
  /** Asks the parent to reload the queue, so both tabs stay in step. */
  readonly changed = output<void>();

  /** Post id currently being approved or rejected, so only its row is busy. */
  readonly busyId = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);

  /** The post whose rejection reason is being typed, if any. */
  readonly rejecting = signal<Item | null>(null);
  readonly reason = signal('');

  readonly isEmpty = computed(() => this.posts().length === 0);

  approve(post: Item): void {
    this.run(post.id, this.admin.approvePost(post.id));
  }

  /**
   * Rejecting asks for a reason first. It is stored on the post and shown to
   * the author, who otherwise has no way to find out why (PB-38).
   */
  startReject(post: Item): void {
    this.actionError.set(null);
    this.reason.set('');
    this.rejecting.set(post);
  }

  cancelReject(): void {
    this.rejecting.set(null);
  }

  confirmReject(): void {
    const post = this.rejecting();

    if (!post) {
      return;
    }

    const reason = this.reason().trim();

    this.rejecting.set(null);
    this.run(post.id, this.admin.rejectPost(post.id, reason === '' ? undefined : reason));
  }

  private run(postId: number, request: ReturnType<AdminService['approvePost']>): void {
    this.busyId.set(postId);
    this.actionError.set(null);

    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.changed.emit();
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);
        this.actionError.set(this.messageFor(error));
        // Someone else may have moderated it first, so refresh either way.
        this.changed.emit();
      },
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    // 422 here means the post is no longer pending, usually because another
    // admin got to it first.
    if (error.status === 422) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'That post is no longer pending.';
    }

    if (error.status === 403) {
      return 'Your account is not allowed to moderate posts.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Something went wrong. Please try again.';
  }
}
