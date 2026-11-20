import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AppNotification } from '../../models/models';
import { relativeTime } from '../../utils/relative-time';
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

  /** Marks the notification read and closes the panel; the link navigates. */
  open(notification: AppNotification): void {
    this.isOpen.set(false);
    this.service.markRead(notification).subscribe({ error: () => undefined });
  }

  markAllRead(): void {
    this.service.markAllRead().subscribe({ error: () => this.refresh() });
  }

  /** The subject line: what the notification is about. */
  title(notification: AppNotification): string {
    return notification.details.post_title ?? 'A post';
  }

  /** A short word for the kind of notification, shown above the subject. */
  label(notification: AppNotification): string {
    switch (notification.type) {
      case 'saved_search_match':
        return notification.details.saved_search_name;
      case 'report_reviewed':
        return 'Your report';
      default:
        return 'Your post';
    }
  }

  /**
   * The moderator's reason for refusing a post. It is sent in the payload but
   * was never shown, which left "Your post was rejected" with no explanation.
   */
  reason(notification: AppNotification): string | null {
    return notification.type === 'post_moderated' ? (notification.details.reason ?? null) : null;
  }

  /** LOST / FOUND for a saved-search match, so the match is scannable. */
  postType(notification: AppNotification): string | null {
    return notification.type === 'saved_search_match' ? notification.details.post_type : null;
  }

  /** "4 minutes ago" reads better at a glance than "19 Nov, 21:12". */
  readonly relativeTime = relativeTime;

  icon(notification: AppNotification): string {
    if (notification.type === 'saved_search_match') {
      return 'bi-search';
    }

    if (notification.type === 'report_reviewed') {
      return notification.details.outcome === 'action_taken' ? 'bi-flag-fill' : 'bi-flag';
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
