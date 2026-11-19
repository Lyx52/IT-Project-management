import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Category, Item, PageMeta } from '../../models/models';
import { ItemsPageComponent } from './items-page';

const API = environment.apiBaseUrl;

const CATEGORIES: Category[] = [
  { id: 1, name: 'Phones' },
  { id: 2, name: 'Keys' },
  { id: 3, name: 'Wallets & Cards' },
];

const item = (id: number): Item => ({
  id,
  type: 'found',
  status: 'approved',
  title: `Item ${id}`,
  description: 'Description',
  latitude: null,
  longitude: null,
  location_name: null,
  event_date: '2026-11-01',
  resolved_at: null,
  images: [],
  category: CATEGORIES[1],
  user: { id: 1, username: 'jane_doe' },
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
});

const page = (items: Item[], meta: Partial<PageMeta> = {}) => ({
  data: items,
  meta: { current_page: 1, last_page: 1, total: items.length, ...meta },
});

describe('ItemsPageComponent', () => {
  let harness: RouterTestingHarness;
  let component: ItemsPageComponent;
  let httpMock: HttpTestingController;

  const signIn = () => {
    localStorage.setItem('findit.token', 'stored-token');
    localStorage.setItem(
      'findit.user',
      JSON.stringify({
        id: 7,
        username: 'jane_doe',
        email: 'jane@example.com',
        email_verified_at: '2026-11-01T10:00:00Z',
        must_verify_email: false,
      }),
    );
  };

  /** Opens the page at `url`, answering the category request. */
  const open = async (url = '/items') => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'items', component: ItemsPageComponent },
          { path: 'login', children: [] },
          { path: 'saved-searches', children: [] },
        ]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(url, ItemsPageComponent);
    httpMock.expectOne(`${API}/category/query`).flush({ data: CATEGORIES });
  };

  /** The pending search request, checked against the expected query params. */
  const expectSearch = (params: Record<string, string>): TestRequest => {
    const request = httpMock.expectOne((req) => req.url === `${API}/posts/query`);
    const sent = Object.fromEntries(
      request.request.params.keys().map((key) => [key, request.request.params.get(key)]),
    );
    expect(sent).toEqual({ page: '1', ...params });
    return request;
  };

  const settle = async () => {
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  };

  const text = (): string => harness.routeNativeElement!.textContent ?? '';
  const query = <T extends Element>(selector: string) =>
    harness.routeNativeElement!.querySelector(selector) as T;
  const button = (label: string) =>
    Array.from(harness.routeNativeElement!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement | undefined;

  const typeSearch = (value: string) => {
    const input = query<HTMLInputElement>('input[type="search"]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    query<HTMLFormElement>('form[role="search"]').dispatchEvent(new Event('submit'));
  };

  const chooseCategory = (value: string) => {
    const select = query<HTMLSelectElement>('select[aria-label="Category"]');
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };

  afterEach(() => {
    // Signed in, the header's bell asks for notifications and the messenger
    // launcher polls conversations to keep its unread badge current. Both are
    // covered by their own specs.
    httpMock.match(`${API}/notifications`);
    httpMock.match(`${API}/messages/conversations`);
    httpMock.verify();
    localStorage.clear();
  });

  it('hides the messenger from a signed-out visitor', async () => {
    await open();
    expectSearch({}).flush(page([item(1)]));
    await settle();

    // The messenger is a personal inbox, not a call to action: a visitor who
    // wants to reach a poster uses Contact on the post, which prompts sign-in.
    expect(query('.messenger-button')).toBeNull();
    expect(query('app-messenger')).toBeNull();
  });

  it('offers the messenger once signed in', async () => {
    signIn();
    await open();
    expectSearch({}).flush(page([item(1)]));
    await settle();

    expect(query('.messenger-button')).not.toBeNull();
  });

  it('shows the whole feed with the total and the categories', async () => {
    await open();
    expectSearch({}).flush(page([item(1), item(2)], { total: 2 }));
    await settle();

    expect(text()).toContain('2 items available');
    expect(text()).toContain('Item 1');
    const options = Array.from(query<HTMLSelectElement>('select').options).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['All categories', 'Phones', 'Keys', 'Wallets & Cards']);
  });

  it('runs the search from the URL, e.g. a link from the home page or a saved search', async () => {
    await open('/items?q=car%20keys&type=found&category_id=2');
    expectSearch({ q: 'car keys', type: 'found', category_id: '2' }).flush(page([item(1)]));
    await settle();

    expect(query<HTMLInputElement>('input[type="search"]').value).toBe('car keys');
    expect(query<HTMLSelectElement>('select').value).toBe('2');
    expect(text()).toContain('1 items match this search');
  });

  it('ignores invalid filters in the URL', async () => {
    await open('/items?type=stolen&category_id=abc');
    expectSearch({}).flush(page([]));
  });

  it('searches on submit and keeps the search in the URL', async () => {
    await open('/items?type=lost');
    expectSearch({ type: 'lost' }).flush(page([]));

    typeSearch('  wallet ');
    await settle();

    expectSearch({ q: 'wallet', type: 'lost' }).flush(page([item(3)]));
    expect(TestBed.inject(Router).url).toBe('/items?q=wallet&type=lost');
  });

  it('narrows by category and by lost/found on the server', async () => {
    await open();
    expectSearch({}).flush(page([]));
    await settle(); // the category options are drawn

    chooseCategory('3');
    await settle();
    expectSearch({ category_id: '3' }).flush(page([]));

    component.selectType('found');
    await settle();
    expectSearch({ category_id: '3', type: 'found' }).flush(page([]));

    component.selectType('all');
    await settle();
    expectSearch({ category_id: '3' }).flush(page([]));
  });

  it('clears every filter on reset', async () => {
    await open('/items?q=keys&type=found&category_id=2');
    expectSearch({ q: 'keys', type: 'found', category_id: '2' }).flush(page([]));

    button('Reset filters')!.click();
    await settle();

    expectSearch({}).flush(page([]));
    expect(TestBed.inject(Router).url).toBe('/items');
    expect(query<HTMLInputElement>('input[type="search"]').value).toBe('');
  });

  it('loads the next page on demand until the last one', async () => {
    await open();
    expectSearch({}).flush(page([item(1), item(2)], { last_page: 2, total: 3 }));
    await settle();

    button('Load more')!.click();
    const next = httpMock.expectOne((req) => req.url === `${API}/posts/query`);
    expect(next.request.params.get('page')).toBe('2');
    // Item 2 moved onto page 2 because a new post arrived: shown only once
    next.flush(page([item(2), item(3)], { current_page: 2, last_page: 2, total: 3 }));
    await settle();

    expect(component.items().map((i) => i.id)).toEqual([1, 2, 3]);
    expect(button('Load more')).toBeUndefined();
  });

  it('shows an error with a retry when the search fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await open();
    expectSearch({}).flush('Server error', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(text()).toContain('Failed to load items. Please try again.');
    button('Retry')!.click();
    expectSearch({}).flush(page([item(1)]));
  });

  describe('saving a search', () => {
    it('offers nothing to save without filters', async () => {
      signIn();
      await open();
      expectSearch({}).flush(page([]));
      await settle();

      expect(button('Save this search')).toBeUndefined();
    });

    it('asks visitors to sign in first and brings them back afterwards', async () => {
      await open('/items?q=keys');
      expectSearch({ q: 'keys' }).flush(page([]));
      await settle();

      const link = query<HTMLAnchorElement>('.save-search a');
      expect(link.textContent?.trim()).toBe('Sign in');
      expect(link.getAttribute('href')).toBe('/login?returnUrl=%2Fitems%3Fq%3Dkeys');
    });

    it('saves the current filters under a suggested name', async () => {
      signIn();
      await open('/items?q=car%20keys&type=found&category_id=2');
      expectSearch({ q: 'car keys', type: 'found', category_id: '2' }).flush(page([]));
      await settle();

      button('Save this search')!.click();
      await settle();
      const name = query<HTMLInputElement>('#saved-search-name');
      expect(name.value).toBe('“car keys” · Found · Keys');

      name.value = 'My car keys';
      name.dispatchEvent(new Event('input'));
      name.form!.dispatchEvent(new Event('submit'));

      const request = httpMock.expectOne(`${API}/saved-searches`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        name: 'My car keys',
        q: 'car keys',
        type: 'found',
        category_id: 2,
      });
      request.flush(
        {
          data: {
            id: 1,
            name: 'My car keys',
            q: 'car keys',
            type: 'found',
            category: CATEGORIES[1],
            created_at: '',
            updated_at: '',
          },
        },
        { status: 201, statusText: 'Created' },
      );
      await settle();

      expect(text()).toContain('Saved as “My car keys”');
    });

    it('shows why the server refused the name', async () => {
      signIn();
      await open('/items?type=lost');
      expectSearch({ type: 'lost' }).flush(page([]));
      await settle();

      button('Save this search')!.click();
      await settle();
      query<HTMLFormElement>('.save-search form').dispatchEvent(new Event('submit'));

      httpMock
        .expectOne(`${API}/saved-searches`)
        .flush(
          { message: 'Invalid', errors: { name: ['The name has already been taken.'] } },
          { status: 422, statusText: 'Unprocessable Content' },
        );
      await settle();

      expect(text()).toContain('The name has already been taken.');
      expect(query('#saved-search-name')).not.toBeNull();
    });
  });
});
