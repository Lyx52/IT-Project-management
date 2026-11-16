import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';
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

  afterEach(() => {
    httpMock.match(`${API}/notifications`);
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
    expect(text()).toContain('Found posts in Wallets & Cards');
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
