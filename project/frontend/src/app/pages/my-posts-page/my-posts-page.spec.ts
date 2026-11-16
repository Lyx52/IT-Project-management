import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { Item } from '../../models/models';
import { MyPostsPage } from './my-posts-page';

const API = environment.apiBaseUrl;

const post = (id: number, status: Item['status']): Item => ({
  id,
  type: 'lost',
  status,
  title: `Post ${id}`,
  description: 'Description',
  latitude: null,
  longitude: null,
  location_name: null,
  event_date: '2026-11-10',
  resolved_at: null,
  images: [],
  category: { id: 3, name: 'Wallets & Cards' },
  user: { id: 7, username: 'jane_doe' },
  created_at: '2026-11-10T10:00:00Z',
  updated_at: '2026-11-10T10:00:00Z',
});

describe('MyPostsPage', () => {
  let fixture: ComponentFixture<MyPostsPage>;
  let httpMock: HttpTestingController;

  const element = () => fixture.nativeElement as HTMLElement;

  const create = () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyPostsPage);
  };

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => httpMock.verify());

  it('lists every post with its status, each linking to its page', async () => {
    create();
    httpMock
      .expectOne((req) => req.url === `${API}/user/posts`)
      .flush({
        data: [post(2, 'pending'), post(1, 'approved')],
        meta: { current_page: 1, last_page: 1, total: 2 },
      });
    await settle();

    const statuses = Array.from(element().querySelectorAll('.item-status')).map((s) =>
      s.textContent?.trim(),
    );
    expect(statuses).toEqual(['pending', 'approved']);
    expect(element().querySelector('a.btn[href="/post/2"]')).not.toBeNull();
  });

  it('says when there are no posts yet', async () => {
    create();
    httpMock
      .expectOne((req) => req.url === `${API}/user/posts`)
      .flush({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } });
    await settle();

    expect(element().textContent).toContain('You have not posted anything yet.');
  });
});
