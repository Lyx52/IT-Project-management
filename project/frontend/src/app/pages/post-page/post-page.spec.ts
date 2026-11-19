import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Item } from '../../models/models';
import { PostPage } from './post-page';

const API = environment.apiBaseUrl;

const post = (id: number, overrides: Partial<Item> = {}): Item => ({
  id,
  type: 'lost',
  status: 'approved',
  title: `Post ${id}`,
  description: 'Black wallet\nwith a red zip',
  latitude: 56.95,
  longitude: 24.1,
  location_name: 'Old Town',
  event_date: '2026-11-10',
  resolved_at: null,
  images: [],
  category: { id: 3, name: 'Wallets & Cards' },
  user: { id: 1, username: 'someone_else' },
  created_at: '2026-11-10T10:00:00Z',
  updated_at: '2026-11-10T10:00:00Z',
  ...overrides,
});

describe('PostPage', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;

  const signInAs = (id: number) => {
    localStorage.setItem('findit.token', 'stored-token');
    localStorage.setItem(
      'findit.user',
      JSON.stringify({
        id,
        username: 'jane_doe',
        email: 'jane@example.com',
        email_verified_at: null,
        must_verify_email: false,
      }),
    );
  };

  const open = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'post/:id', component: PostPage },
          { path: 'items', children: [] },
        ]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PostPage);
  };

  const settle = async () => {
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  };

  const text = () => harness.routeNativeElement!.textContent ?? '';
  const query = (selector: string) => harness.routeNativeElement!.querySelector(selector);

  afterEach(() => {
    // Signed in, the header's bell asks for notifications and the messenger
    // launcher polls conversations for its unread badge. Both have their own
    // specs; this page only has to not break them.
    httpMock.match(`${API}/notifications`);
    httpMock.match(`${API}/messages/conversations`);
    httpMock.verify();
    localStorage.clear();
  });

  it('shows the post to anyone, without matches for someone else’s post', async () => {
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({ data: post(5) });
    await settle();

    expect(text()).toContain('Post 5');
    expect(text()).toContain('Old Town');
    expect(text()).toContain('Lost on');
    expect(text()).toContain('Posted by someone_else');
    expect(text()).not.toContain('Possible matches');
    httpMock.expectNone(`${API}/post/5/matches`);
  });

  it('shows the author their status and possible matches with distances', async () => {
    signInAs(7);
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { status: 'pending', user: { id: 7, username: 'jane_doe' } }) });
    await settle();

    httpMock.expectOne(`${API}/post/5/matches`).flush({
      data: [
        post(8, { type: 'found', title: 'Found a wallet', distance_m: 350 }),
        post(9, { type: 'found', title: 'Wallet at the bus stop', distance_m: 1420 }),
      ],
    });
    await settle();

    expect(text()).toContain('pending');
    expect(text()).toContain('Possible matches');
    expect(text()).toContain('Found items in');
    expect(text()).toContain('Wallets & Cards');
    expect(text()).toContain('Found a wallet');
    expect(text()).toContain('350 m away');
    expect(text()).toContain('1.4 km away');
  });

  it('tells the author when there are no matches yet', async () => {
    signInAs(7);
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { user: { id: 7, username: 'jane_doe' } }) });
    await settle();
    httpMock.expectOne(`${API}/post/5/matches`).flush({ data: [] });
    await settle();

    expect(text()).toContain('No possible matches yet');
  });

  it('offers Resolve only to the author', async () => {
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({ data: post(5) });
    await settle();

    // It used to render inside the details grid for every visitor, even though
    // only the author could act on it.
    expect(query('.owner-actions')).toBeNull();
    expect(text()).not.toContain('Mark as resolved');
  });

  it('shows the author a resolve action outside the details grid', async () => {
    signInAs(7);
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { user: { id: 7, username: 'jane_doe' } }) });
    await settle();
    httpMock.expectOne(`${API}/post/5/matches`).flush({ data: [] });
    await settle();

    const actions = query('.owner-actions');

    expect(actions).not.toBeNull();
    expect(actions!.textContent).toContain('Mark as resolved');
    expect(query('.post-details .details-grid button')).toBeNull();
  });

  it('replaces the resolve action with a badge once resolved', async () => {
    signInAs(7);
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({
      data: post(5, { status: 'resolved', user: { id: 7, username: 'jane_doe' } }),
    });
    await settle();
    httpMock.expectOne(`${API}/post/5/matches`).flush({ data: [] });
    await settle();

    expect(text()).not.toContain('Mark as resolved');
    expect(query('.resolved-badge')).not.toBeNull();
  });

  it('shows one photo at a time, with arrows that wrap', async () => {
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({
      data: post(5, {
        images: [
          { id: 1, url: 'a.jpg' },
          { id: 2, url: 'b.jpg' },
          { id: 3, url: 'c.jpg' },
        ],
      }),
    });
    await settle();

    const shown = () =>
      Array.from(harness.routeNativeElement!.querySelectorAll('.post-carousel img')).filter(
        (img) => !img.hasAttribute('hidden'),
      );

    expect(shown()).toHaveLength(1);
    expect(shown()[0].getAttribute('src')).toBe('a.jpg');
    expect(text()).toContain('1 / 3');

    (query('.carousel-prev') as HTMLButtonElement).click();
    harness.fixture.detectChanges();

    // Wraps to the last photo rather than dead-ending on the first
    expect(shown()[0].getAttribute('src')).toBe('c.jpg');
    expect(text()).toContain('3 / 3');

    (query('.carousel-next') as HTMLButtonElement).click();
    harness.fixture.detectChanges();

    expect(shown()[0].getAttribute('src')).toBe('a.jpg');
  });

  it('shows no carousel controls for a single photo', async () => {
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { images: [{ id: 1, url: 'only.jpg' }] }) });
    await settle();

    expect(query('.post-carousel img')).not.toBeNull();
    expect(query('.carousel-arrow')).toBeNull();
    expect(query('.carousel-dots')).toBeNull();
  });

  it('resolves in place, with no browser dialog and no redirect', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    signInAs(7);
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { user: { id: 7, username: 'jane_doe' } }) });
    await settle();
    httpMock.expectOne(`${API}/post/5/matches`).flush({ data: [] });
    await settle();

    (query('.owner-actions button') as HTMLButtonElement).click();
    httpMock.expectOne(`${API}/post/5/resolve`).flush({});
    await settle();

    // A native alert() blocks the page and is styled by the browser, not us
    expect(alertSpy).not.toHaveBeenCalled();
    expect(query('.resolved-badge')).not.toBeNull();
    expect(text()).not.toContain('Mark as resolved');
    // Still on the post, not bounced to /my-posts
    expect(query('.owner-actions')).not.toBeNull();
  });

  it('reports a failed resolve in the page, not in a dialog', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    signInAs(7);
    await open('/post/5');
    httpMock
      .expectOne(`${API}/post/5`)
      .flush({ data: post(5, { user: { id: 7, username: 'jane_doe' } }) });
    await settle();
    httpMock.expectOne(`${API}/post/5/matches`).flush({ data: [] });
    await settle();

    (query('.owner-actions button') as HTMLButtonElement).click();
    httpMock
      .expectOne(`${API}/post/5/resolve`)
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(query('.owner-error')!.textContent).toContain('Could not resolve the post');
    // The action stays available so it can be retried
    expect(text()).toContain('Mark as resolved');
  });

  it('offers Create post to everyone and the messenger only when signed in', async () => {
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({ data: post(5) });
    await settle();

    // Create post is a call to action: a visitor is prompted to sign in inside
    // the form. The messenger is a personal inbox, so it stays hidden.
    expect(query('app-create-post')).not.toBeNull();
    expect(query('.messenger-button')).toBeNull();
  });

  it('offers the messenger to a signed-in visitor', async () => {
    // Not the author (the fixture's post belongs to id 1), so no matches load
    signInAs(99);
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({ data: post(5) });
    await settle();

    expect(query('.messenger-button')).not.toBeNull();
    expect(query('app-create-post')).not.toBeNull();
  });

  it('says so when the post does not exist or is not public', async () => {
    await open('/post/404');
    httpMock
      .expectOne(`${API}/post/404`)
      .flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(text()).toContain('Post not found');
  });

  it('loads the next post when following a link to a match', async () => {
    await open('/post/5');
    httpMock.expectOne(`${API}/post/5`).flush({ data: post(5) });
    await settle();

    await harness.navigateByUrl('/post/8');
    httpMock.expectOne(`${API}/post/8`).flush({ data: post(8, { title: 'Found a wallet' }) });
    await settle();

    expect(text()).toContain('Found a wallet');
  });
});
