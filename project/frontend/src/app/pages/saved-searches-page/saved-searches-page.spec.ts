import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SavedSearch } from '../../models/models';
import { SavedSearchesPage } from './saved-searches-page';

const API = environment.apiBaseUrl;

const KEYS: SavedSearch = {
  id: 1,
  name: 'My car keys',
  q: 'car keys',
  type: 'found',
  category: { id: 2, name: 'Keys' },
  created_at: '',
  updated_at: '',
};

const PHONES: SavedSearch = {
  id: 2,
  name: 'Phones',
  q: null,
  type: null,
  category: { id: 1, name: 'Phones' },
  created_at: '',
  updated_at: '',
};

describe('SavedSearchesPage', () => {
  let fixture: ComponentFixture<SavedSearchesPage>;
  let httpMock: HttpTestingController;

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const rows = () => Array.from(element().querySelectorAll('li.list-group-item')) as HTMLElement[];
  const buttonIn = (row: HTMLElement, label: string) =>
    Array.from(row.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith(label),
    ) as HTMLButtonElement;

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const create = async (searches = [KEYS, PHONES]) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'items', children: [] }]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SavedSearchesPage);
    httpMock.expectOne(`${API}/saved-searches`).flush({ data: searches });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('lists each search with its filters and a link that runs it again', async () => {
    await create();

    expect(rows().length).toBe(2);
    expect(rows()[0].textContent).toContain('My car keys');
    expect(rows()[0].textContent).toContain('“car keys” · Found items · Keys');
    expect(rows()[1].textContent).toContain('Phones');

    const open = rows()[0].querySelector('a') as HTMLAnchorElement;
    expect(open.getAttribute('href')).toBe('/items?q=car%20keys&type=found&category_id=2');
    expect((rows()[1].querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/items?category_id=1',
    );
  });

  it('explains how to add one when there are none', async () => {
    await create([]);

    expect(text()).toContain('You have no saved searches yet.');
  });

  it('renames a search', async () => {
    await create();

    buttonIn(rows()[0], 'Rename').click();
    await settle();
    const input = rows()[0].querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('My car keys');
    input.value = 'Car keys';
    input.dispatchEvent(new Event('input'));
    input.form!.dispatchEvent(new Event('submit'));

    const request = httpMock.expectOne(`${API}/saved-search/1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Car keys' });
    request.flush({ data: { ...KEYS, name: 'Car keys' } });
    await settle();

    expect(rows()[0].querySelector('input')).toBeNull();
    expect(rows()[0].textContent).toContain('Car keys');
  });

  it('keeps the form open and explains a refused name', async () => {
    await create();

    buttonIn(rows()[0], 'Rename').click();
    await settle();
    const input = rows()[0].querySelector('input') as HTMLInputElement;
    input.value = 'Phones';
    input.dispatchEvent(new Event('input'));
    input.form!.dispatchEvent(new Event('submit'));

    httpMock
      .expectOne(`${API}/saved-search/1`)
      .flush(
        { message: 'Invalid', errors: { name: ['The name has already been taken.'] } },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await settle();

    expect(rows()[0].textContent).toContain('The name has already been taken.');
    expect(rows()[0].querySelector('input')).not.toBeNull();
  });

  it('deletes a search only after confirming', async () => {
    await create();

    buttonIn(rows()[1], 'Delete').click();
    await settle();
    httpMock.expectNone(`${API}/saved-search/2`);

    buttonIn(rows()[1], 'Delete “Phones”?').click();
    const request = httpMock.expectOne(`${API}/saved-search/2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(rows().length).toBe(1);
    expect(text()).not.toContain('Phones');
  });
});
