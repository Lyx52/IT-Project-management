import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Item } from '../../models/models';
import { HomePageComponent } from './home-page';

const item = (id: number, title: string): Item => ({
  id,
  type: 'lost',
  status: 'approved',
  title,
  description: 'Description',
  latitude: null,
  longitude: null,
  location_name: null,
  event_date: '2026-11-01',
  resolved_at: null,
  images: [],
  category: { id: 1, name: 'Phones' },
  user: { id: 1, username: 'jane_doe' },
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
});

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let httpMock: HttpTestingController;

  const text = (): string => fixture.nativeElement.textContent;

  /** Lets Angular redraw the way it would in the browser after a response. */
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    // The create-post form inside the page asks for categories too
    httpMock.match(`${environment.apiBaseUrl}/category/query`);
    httpMock.verify();
  });

  it('shows the posts once they arrive instead of staying on "Loading items..."', async () => {
    expect(text()).toContain('Loading items...');

    httpMock
      .expectOne(`${environment.apiBaseUrl}/posts`)
      .flush({ data: [item(1, 'Black wallet'), item(2, 'House keys')] });
    await settle();

    expect(text()).not.toContain('Loading items...');
    expect(text()).toContain('Black wallet');
    expect(text()).toContain('House keys');
  });

  it('says so when there are no posts yet', async () => {
    httpMock.expectOne(`${environment.apiBaseUrl}/posts`).flush({ data: [] });
    await settle();

    expect(text()).not.toContain('Loading items...');
    expect(text()).toContain('No items found yet.');
  });

  it('shows an error with a retry button when the posts fail to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    httpMock
      .expectOne(`${environment.apiBaseUrl}/posts`)
      .flush('Server error', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(text()).not.toContain('Loading items...');
    expect(text()).toContain('Failed to load items. Please try again.');
  });
});
