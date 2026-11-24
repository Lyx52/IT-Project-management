import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { AdminUser, UserStatusFilter } from '../../models/admin.model';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-users',
  imports: [DatePipe],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
})
export class AdminUsers implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly search = signal('');
  readonly status = signal<UserStatusFilter>('all');

  readonly isEmpty = computed(() => !this.isLoading() && this.users().length === 0);

  /** The signed-in admin, so their own row cannot offer a ban button. */
  private readonly currentUserId = computed(() => this.auth.user()?.id ?? null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.admin.users({ search: this.search(), status: this.status() }).subscribe({
      next: (page) => {
        this.users.set(page.data);
        this.total.set(page.meta?.total ?? page.data.length);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load users. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  selectStatus(status: UserStatusFilter): void {
    this.status.set(status);
    this.load();
  }

  /** An admin cannot be banned, and neither can you ban yourself. */
  canBan(user: AdminUser): boolean {
    return user.role !== 'admin' && user.id !== this.currentUserId();
  }

  isBanned(user: AdminUser): boolean {
    return user.banned_at !== null;
  }

  toggleBan(user: AdminUser): void {
    this.busyId.set(user.id);
    this.actionError.set(null);

    const request = this.isBanned(user)
      ? this.admin.unbanUser(user.id)
      : this.admin.banUser(user.id);

    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);
        this.actionError.set(this.messageFor(error));
      },
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    // 422 is the backend refusing to ban an administrator.
    if (error.status === 422) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'That account cannot be banned.';
    }

    if (error.status === 403) {
      return 'Your account is not allowed to ban users.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Something went wrong. Please try again.';
  }
}
