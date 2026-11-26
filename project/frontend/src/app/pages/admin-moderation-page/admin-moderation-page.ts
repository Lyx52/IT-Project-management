import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import {
  AdminModerationService,
  ModerationQueue,
  UserReportQueueItem,
} from '../../services/admin-moderation';

@Component({
  selector: 'app-admin-moderation-page',
  standalone: true,
  imports: [Header, DatePipe, RouterLink],
  templateUrl: './admin-moderation-page.html',
})
export class AdminModerationPage {
  private readonly moderation = inject(AdminModerationService);

  readonly queue = signal<ModerationQueue>({ open_reports: [], open_user_reports: [] });
  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly actionMessage = signal('');
  readonly actioningUserId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.moderation.getQueue().subscribe({
      next: (response) => {
        this.queue.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load the moderation queue. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  banUser(report: UserReportQueueItem): void {
    const user = report.reported_user;

    if (!user || user.banned_at || this.actioningUserId() !== null) {
      return;
    }

    if (!window.confirm(`Ban ${user.username}? Their active sessions will be signed out.`)) {
      return;
    }

    this.actioningUserId.set(user.id);
    this.actionError.set('');
    this.actionMessage.set('');

    this.moderation.banUser(user.id).subscribe({
      next: (response) => {
        this.actioningUserId.set(null);
        this.actionMessage.set(response.message);
        this.load();
      },
      error: (error) => {
        this.actioningUserId.set(null);
        this.actionError.set(error.error?.message ?? 'Could not ban this user. Please try again.');
      },
    });
  }
}
