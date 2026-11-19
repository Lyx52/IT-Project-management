import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { ModerationReport } from '../../models/admin.model';
import { Item } from '../../models/models';
import { AdminReports } from './admin-reports';

const POST = {
  id: 9,
  type: 'lost',
  status: 'approved',
  title: 'Suspicious post',
  description: 'Buy cheap things',
  images: [],
  category: { id: 1, name: 'Other' },
  user: { id: 42, username: 'spammer' },
  event_date: '2026-11-01',
  created_at: '2026-11-01T00:00:00Z',
} as unknown as Item;

const REPORT: ModerationReport = {
  id: 3,
  reason: 'Spam',
  status: 'open',
  created_at: '2026-11-14T00:00:00Z',
  reporter: { id: 7, username: 'jane_doe' },
  post: POST,
};

describe('AdminReports', () => {
  const base = `${environment.apiBaseUrl}/admin`;

  let fixture: ComponentFixture<AdminReports>;
  let component: AdminReports;
  let httpMock: HttpTestingController;
  let changedCount: number;

  const setup = (reports: ModerationReport[] = [REPORT]) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminReports);
    component = fixture.componentInstance;

    changedCount = 0;
    fixture.componentRef.setInput('reports', reports);
    component.changed.subscribe(() => (changedCount += 1));
    fixture.detectChanges();
  };

  const html = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => httpMock.verify());

  it('shows the reason, the reporter and the reported post', () => {
    setup();

    expect(html()).toContain('Spam');
    expect(html()).toContain('jane_doe');
    expect(html()).toContain('Suspicious post');
    expect(html()).toContain('spammer');
  });

  it('says so when there is nothing to review', () => {
    setup([]);

    expect(html()).toContain('No open reports.');
  });

  it('hides the post AND closes the report, so the queue entry clears', () => {
    setup();

    component.hidePost(REPORT);

    // Closing alone would leave the post public, so both calls must happen.
    httpMock.expectOne(`${base}/posts/9/takedown`).flush({ data: POST });
    httpMock.expectOne(`${base}/reports/3/close`).flush({});

    expect(changedCount).toBe(1);
    expect(component.busyId()).toBeNull();
  });

  it('tells the server which action it took, so the reporter is told', () => {
    setup();

    component.hidePost(REPORT);
    httpMock.expectOne(`${base}/posts/9/takedown`).flush({ data: POST });

    // The server cannot work this out alone: banning the author also hides the
    // post without changing its status.
    const close = httpMock.expectOne(`${base}/reports/3/close`);

    expect(close.request.body).toEqual({ outcome: 'action_taken' });
    close.flush({});
  });

  it('marks a dismissal as such', () => {
    setup();

    component.dismiss(REPORT);

    const close = httpMock.expectOne(`${base}/reports/3/close`);

    expect(close.request.body).toEqual({ outcome: 'dismissed' });
    close.flush({});
  });

  it('bans the author by their user id, then closes the report', () => {
    setup();

    component.banAuthor(REPORT);

    httpMock.expectOne(`${base}/users/42/ban`).flush({});
    httpMock.expectOne(`${base}/reports/3/close`).flush({});

    expect(changedCount).toBe(1);
  });

  it('dismissing only closes the report, leaving the post alone', () => {
    setup();

    component.dismiss(REPORT);

    httpMock.expectOne(`${base}/reports/3/close`).flush({});
    httpMock.expectNone(`${base}/posts/9/takedown`);

    expect(changedCount).toBe(1);
  });

  it('explains a 422 and still reloads, since someone else may have acted', () => {
    setup();

    component.dismiss(REPORT);
    httpMock
      .expectOne(`${base}/reports/3/close`)
      .flush({ message: 'This report is already closed.' }, { status: 422, statusText: 'x' });

    expect(component.actionError()).toBe('This report is already closed.');
    expect(changedCount).toBe(1);
  });

  it('offers no post actions when the reported post is gone', () => {
    setup([{ ...REPORT, post: null }]);

    expect(html()).toContain('The reported post has been deleted.');

    component.hidePost({ ...REPORT, post: null });
    httpMock.verify();
  });
});
