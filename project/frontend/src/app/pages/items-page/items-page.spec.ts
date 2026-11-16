import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Category, Item } from '../../models/models';
import { ItemsPageComponent } from './items-page';

const CATEGORIES: Category[] = [
  { id: 1, name: 'Phones' },
  { id: 2, name: 'Keys' },
  { id: 3, name: 'Wallets & Cards' },
];

const item = (id: number, type: Item['type'], categoryId: number): Item => ({
  id,
  type,
  status: 'approved',
  title: `Item ${id}`,
  description: 'Description',
  latitude: null,
  longitude: null,
  location_name: null,
  event_date: '2026-11-01',
  resolved_at: null,
  images: [],
  category: CATEGORIES.find((c) => c.id === categoryId)!,
  user: { id: 1, username: 'jane_doe' },
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
});

const ITEMS: Item[] = [item(1, 'lost', 1), item(2, 'found', 1), item(3, 'lost', 2)];

describe('ItemsPageComponent', () => {
  let fixture: ComponentFixture<ItemsPageComponent>;
  let component: ItemsPageComponent;
  let httpMock: HttpTestingController;

  const select = (): HTMLSelectElement =>
    fixture.nativeElement.querySelector('select[aria-label="Category"]');

  const choose = (value: string) => {
    select().value = value;
    select().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  const shownTitles = (): string[] =>
    component
      .filteredItems()
      .map((shown) => shown.title)
      .sort();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ItemsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const answerRequests = (categories: Category[] | 'fail' = CATEGORIES) => {
    httpMock.expectOne(`${environment.apiBaseUrl}/posts`).flush({ data: ITEMS });

    const categoryRequest = httpMock.expectOne(`${environment.apiBaseUrl}/category/query`);
    if (categories === 'fail') {
      categoryRequest.flush('Server error', {
        status: 500,
        statusText: 'Server Error',
      });
    } else {
      categoryRequest.flush({ data: categories });
    }

    fixture.detectChanges();
  };

  it('lists the categories from the API in the filter', () => {
    answerRequests();

    const options = Array.from(select().options).map((option) => option.textContent?.trim());
    expect(options).toEqual(['All categories', 'Phones', 'Keys', 'Wallets & Cards']);
    expect(select().value).toBe('');
  });

  it('shows only the items in the chosen category', () => {
    answerRequests();

    choose('1');

    expect(component.selectedCategoryId()).toBe(1);
    expect(shownTitles()).toEqual(['Item 1', 'Item 2']);
  });

  it('combines the category with the lost/found switch', () => {
    answerRequests();

    choose('1');
    component.selectType('lost');

    expect(shownTitles()).toEqual(['Item 1']);
  });

  it('goes back to every item for "All categories"', () => {
    answerRequests();

    choose('2');
    choose('');

    expect(component.selectedCategoryId()).toBeNull();
    expect(shownTitles()).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });

  it('clears both the category and the lost/found switch on reset', () => {
    answerRequests();
    choose('2');
    component.selectType('found');

    const reset = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reset filters')!;
    reset.click();
    fixture.detectChanges();

    expect(component.selectedType()).toBe('all');
    expect(component.selectedCategoryId()).toBeNull();
    expect(select().value).toBe('');
    expect(shownTitles()).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });

  it('still shows the items when the categories fail to load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    answerRequests('fail');

    expect(Array.from(select().options).map((option) => option.value)).toEqual(['']);
    expect(component.loadError()).toBe('');
    expect(shownTitles()).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });
});
