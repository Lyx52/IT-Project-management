import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { SavedSearch } from '../../models/models';
import { SavedSearchesPage } from './saved-searches-page';

const URL = `${environment.apiBaseUrl}/saved-searches`;

const search = (overrides: Partial<SavedSearch> = {}): SavedSearch => ({
  id: 1,
  name: 'Car keys near campus',
  q: 'car keys',
  type: 'lost',
  category: { id: 2, name: 'Keys' },
  created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('SavedSearchesPage', () => {
  let fixture: ComponentFixture<SavedSearchesPage>;
  let component: SavedSearchesPage;
  let httpMock: HttpTestingController;

  const open = (searches: SavedSearch[] = [search()]) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SavedSearchesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(URL).flush({ data: searches });
    fixture.detectChanges();
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => host().textContent ?? '';

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    httpMock.match(() => true);
    httpMock.verify();
    localStorage.clear();
  });

  it('shows each filter as its own chip', () => {
    open();

    const chips = Array.from(host().querySelectorAll('.saved-chip')).map((c) =>
      c.textContent?.trim(),
    );

    // Previously one grey sentence: '"car keys" · Lost items · Keys'
    expect(chips).toEqual(['“car keys”', 'lost', 'Keys']);
  });

  it('leaves out chips for filters the search does not use', () => {
    open([search({ q: null, type: null })]);

    expect(component.chips(component.searches()[0])).toEqual([{ label: 'Keys', kind: 'category' }]);
  });

  it('says when the search was saved', () => {
    open();

    // created_at was on the model but never shown
    expect(text()).toContain('Saved 3 days ago');
  });

  it('asks before deleting, without resizing the Delete button', () => {
    open();

    const deleteButton = host().querySelector<HTMLButtonElement>('.saved-btn-danger')!;
    const before = deleteButton.textContent?.trim();

    deleteButton.click();
    fixture.detectChanges();

    expect(host().querySelector('.saved-confirm')).not.toBeNull();
    expect(text()).toContain('You will stop being notified');
    // The button used to become 'Delete “<long name>”?' and reflow the row
    expect(host().querySelector('.saved-btn-danger')!.textContent?.trim()).toBe(before);
  });

  it('names the search it is renaming', () => {
    open();

    Array.from(host().querySelectorAll<HTMLButtonElement>('.saved-btn'))
      .find((b) => b.textContent?.trim() === 'Rename')!
      .click();
    fixture.detectChanges();

    expect(text()).toContain('Rename “Car keys near campus”');
    expect(host().querySelector('#rename-1')).not.toBeNull();
  });

  it('offers a way out when there is nothing saved', () => {
    open([]);

    expect(text()).toContain('No saved searches yet');
    expect(host().querySelector<HTMLAnchorElement>('.saved-empty a')!.getAttribute('href')).toBe(
      '/items',
    );
  });
});
