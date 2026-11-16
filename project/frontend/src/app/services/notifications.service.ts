import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppNotification, NotificationPage } from '../models/models';

/**
 * The signed-in user's notifications: saved-search matches and moderation
 * results. Holds the latest page and the unread count so the header bell and
 * anything else showing them stay in step.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

  private readonly latest = signal<AppNotification[]>([]);
  private readonly unread = signal(0);

  readonly notifications = this.latest.asReadonly();
  readonly unreadCount = this.unread.asReadonly();

  /** Fetches the newest 20 and the unread count across all of them. */
  load(): Observable<NotificationPage> {
    return this.http.get<NotificationPage>(`${environment.apiBaseUrl}/notifications`).pipe(
      tap((page) => {
        this.latest.set(page.data);
        this.unread.set(page.meta.unread_count);
      }),
    );
  }

  markRead(notification: AppNotification): Observable<unknown> {
    // Updated before the request returns, so the badge reacts to the click at once
    if (notification.read_at === null) {
      const now = new Date().toISOString();
      this.latest.update((list) =>
        list.map((n) => (n.id === notification.id ? { ...n, read_at: now } : n)),
      );
      this.unread.update((count) => Math.max(0, count - 1));
    }

    return this.http.post(`${environment.apiBaseUrl}/notification/${notification.id}/read`, {});
  }

  markAllRead(): Observable<unknown> {
    const now = new Date().toISOString();
    this.latest.update((list) => list.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    this.unread.set(0);

    return this.http.post(`${environment.apiBaseUrl}/notifications/read`, {});
  }

  /** Forgets everything, e.g. on sign-out, so the next user starts clean. */
  clear(): void {
    this.latest.set([]);
    this.unread.set(0);
  }
}
