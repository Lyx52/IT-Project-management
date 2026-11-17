import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AppNotification } from '../../models/models';
import { NotificationService } from '../../services/notifications.service';

/** How often the unread count is refreshed while the page is open. */
export const NOTIFICATION_POLL_MS = 60_000;

/**
 * The header bell: unread count, and a dropdown with the latest
 * notifications. Only rendered for signed-in users, so it starts polling on
 * sign-in and stops when the header drops it on sign-out.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [DatePipe, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell {
  private readonly service = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly notifications = this.service.notifications;
  readonly unreadCount = this.service.unreadCount;
  readonly isOpen = signal(false);
  readonly loadError = signal(false);

  private request?: Subscription;

  constructor() {
    this.refresh();
    const polling = interval(NOTIFICATION_POLL_MS).subscribe(() => this.refresh());

    inject(DestroyRef).onDestroy(() => {
      polling.unsubscribe();
      this.request?.unsubscribe();
      this.service.clear();
    });
  }

  refresh(): void {
    this.request?.unsubscribe();
    this.request = this.service.load().subscribe({
      next: () => this.loadError.set(false),
      error: () => this.loadError.set(true),
    });
  }

  toggle(): void {
    const open = !this.isOpen();
    this.isOpen.set(open);

    if (open) {
      this.refresh();
    }
  }

  open(notification: AppNotification): void {
    this.isOpen.set(false);
    this.service.markRead(notification).subscribe({ error: () => undefined });
    this.router.navigate(['/post', notification.details.post_id]);
  }

  markAllRead(): void {
    this.service.markAllRead().subscribe({ error: () => this.refresh() });
  }

  icon(notification: AppNotification): string {
    if (notification.type === 'saved_search_match') {
      return 'bi-search';
    }

    return notification.details.status === 'approved' ? 'bi-check-circle' : 'bi-x-circle';
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.isOpen.set(false);
  }
}
