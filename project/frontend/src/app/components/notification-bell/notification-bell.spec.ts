import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../../models/models';
import { NotificationService } from '../../services/notifications.service';
import { NOTIFICATION_POLL_MS, NotificationBell } from './notification-bell';

const API = environment.apiBaseUrl;

const MATCH: AppNotification = {
  id: '1cf2b27d-e9ca-4468-8b90-127a6e45b411',
  type: 'saved_search_match',
  details: {
    saved_search_id: 1,
    saved_search_name: 'My car keys',
    post_id: 12,
    post_title: 'Found car keys',
    post_type: 'found',
    message: 'A new post matches your saved search "My car keys".',
  },
  read_at: null,
  created_at: '2026-11-16T10:00:00Z',
};

const APPROVED: AppNotification = {
  id: '6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b',
  type: 'post_moderated',
  details: {
    post_id: 3,
    post_title: 'Lost wallet',
    status: 'approved',
    message: 'Your post has been approved and is now visible in the public feed.',
    reason: null,
  },
  read_at: '2026-11-15T10:00:00Z',
  created_at: '2026-11-15T09:00:00Z',
};

const PAGE = (data: AppNotification[], unread: number) => ({
  data,
  meta: { current_page: 1, last_page: 1, total: data.length, unread_count: unread },
});

describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let httpMock: HttpTestingController;

  const element = () => fixture.nativeElement as HTMLElement;
  const bell = () => element().querySelector('.bell-button') as HTMLButtonElement;

  const expectLoad = () => httpMock.expectOne(`${API}/notifications`);

  const create = async (data = [MATCH, APPROVED], unread = 1) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    expectLoad().flush(PAGE(data, unread));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const openPanel = async (data = [MATCH, APPROVED], unread = 1) => {
    bell().click();
    expectLoad().flush(PAGE(data, unread));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('shows the unread count on the bell', async () => {
    await create([MATCH], 3);

    expect(element().querySelector('.bell-count')?.textContent?.trim()).toBe('3');
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 3 unread');
  });

  it('shows no count when everything is read', async () => {
    await create([APPROVED], 0);

    expect(element().querySelector('.bell-count')).toBeNull();
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
  });

  it('lists the latest notifications when opened, refreshing them first', async () => {
    await create();
    await openPanel();

    const items = element().querySelectorAll('.bell-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Found car keys');
    expect(items[0].classList).toContain('unread');
    expect(items[1].classList).not.toContain('unread');
  });

  it('links to the post and marks the notification read', async () => {
    await create();
    await openPanel();

    const action = element().querySelector('.bell-action') as HTMLAnchorElement;

    // A real link, so it can be middle-clicked or opened in a new tab, rather
    // than a row that navigates programmatically.
    expect(action.getAttribute('href')).toBe('/post/12');

    action.click();

    httpMock.expectOne(`${API}/notification/${MATCH.id}/read`).flush({ data: MATCH });
    expect(TestBed.inject(NotificationService).unreadCount()).toBe(0);
  });

  it('shows the moderator\u2019s reason on a rejected post', async () => {
    const rejected = {
      id: 'n3',
      type: 'post_moderated' as const,
      read_at: null,
      created_at: new Date().toISOString(),
      details: {
        post_id: 12,
        post_title: 'Black wallet',
        status: 'rejected' as const,
        message: 'Your post was rejected by a moderator.',
        reason: 'The photo shows someone else\u2019s property.',
      },
    };

    await create([rejected], 1);
    await openPanel([rejected], 1);

    // The reason is in the payload but was never rendered, which left the
    // notification saying only that the post was refused.
    const reason = element().querySelector('.bell-reason');

    expect(reason).not.toBeNull();
    expect(reason!.textContent).toContain('someone else\u2019s property');
  });

  it('marks unread rows with a dot, not colour alone', async () => {
    await create();
    await openPanel();

    const items = element().querySelectorAll('.bell-item');

    expect(items[0].querySelector('.bell-dot')).not.toBeNull();
    expect(items[1].querySelector('.bell-dot')).toBeNull();
  });

  it('keeps the panel to notifications only', async () => {
    await create();
    await openPanel();

    // Saved searches and My posts live in the account menu in the header; the
    // panel repeating them just made it longer.
    const links = Array.from(element().querySelectorAll('a')).map((a) => a.textContent?.trim());

    expect(links.every((text) => text?.startsWith('View details'))).toBe(true);
    expect(element().textContent).not.toContain('Saved searches');
  });

  it('marks everything read at once', async () => {
    await create([MATCH], 4);
    await openPanel([MATCH], 4);

    (
      Array.from(element().querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Mark all as read',
      ) as HTMLButtonElement
    ).click();
    httpMock.expectOne(`${API}/notifications/read`).flush(null, { status: 204, statusText: '' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element().querySelector('.bell-count')).toBeNull();
  });

  it('checks for new notifications every minute', async () => {
    // Only intervals: whenStable() still needs real timeouts
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await create([], 0);

    vi.advanceTimersByTime(NOTIFICATION_POLL_MS);
    expectLoad().flush(PAGE([MATCH], 1));

    expect(TestBed.inject(NotificationService).unreadCount()).toBe(1);
  });

  it('stops checking and forgets the notifications when removed, e.g. on sign-out', async () => {
    // Only intervals: whenStable() still needs real timeouts
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await create([MATCH], 1);

    fixture.destroy();
    vi.advanceTimersByTime(NOTIFICATION_POLL_MS * 2);

    // verify() in afterEach fails if another request went out
    expect(TestBed.inject(NotificationService).unreadCount()).toBe(0);
  });
});
