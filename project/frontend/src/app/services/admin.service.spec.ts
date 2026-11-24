import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const base = `${environment.apiBaseUrl}/admin`;

  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('unwraps the queue envelope', () => {
    let pending = -1;

    service.queue().subscribe((queue) => (pending = queue.pending_posts.length));

    httpMock
      .expectOne(`${base}/moderation/queue`)
      .flush({ data: { pending_posts: [{ id: 1 }], open_reports: [] } });

    expect(pending).toBe(1);
  });

  it('approves a post', () => {
    service.approvePost(5).subscribe();

    const request = httpMock.expectOne(`${base}/posts/5/approve`);

    expect(request.request.method).toBe('POST');
    request.flush({ data: { id: 5 } });
  });

  it('sends a reason when rejecting, and omits it when there is none', () => {
    service.rejectPost(5, 'Spam').subscribe();
    httpMock.expectOne(`${base}/posts/5/reject`).flush({ data: { id: 5 } });

    service.rejectPost(6).subscribe();
    const withoutReason = httpMock.expectOne(`${base}/posts/6/reject`);

    expect(withoutReason.request.body).toEqual({});
    withoutReason.flush({ data: { id: 6 } });
  });

  it('takes a published post down through its own endpoint, not reject', () => {
    service.takedownPost(9, 'Offensive').subscribe();

    const request = httpMock.expectOne(`${base}/posts/9/takedown`);

    expect(request.request.body).toEqual({ reason: 'Offensive' });
    request.flush({ data: { id: 9 } });
  });

  it('closes a report', () => {
    service.closeReport(3).subscribe();

    httpMock.expectOne(`${base}/reports/3/close`).flush({ message: 'Report closed.' });
  });

  it('bans and unbans by id', () => {
    service.banUser(4).subscribe();
    httpMock.expectOne(`${base}/users/4/ban`).flush({});

    service.unbanUser(4).subscribe();
    httpMock.expectOne(`${base}/users/4/unban`).flush({});
  });

  it('passes search and status as query parameters', () => {
    service.users({ search: 'jane', status: 'banned' }).subscribe();

    const request = httpMock.expectOne(
      (req) => req.url === `${base}/users` && req.params.get('search') === 'jane',
    );

    expect(request.request.params.get('status')).toBe('banned');
    request.flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
  });

  it('omits the status parameter when it is "all"', () => {
    service.users({ status: 'all' }).subscribe();

    const request = httpMock.expectOne((req) => req.url === `${base}/users`);

    expect(request.request.params.has('status')).toBe(false);
    request.flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
  });
});
