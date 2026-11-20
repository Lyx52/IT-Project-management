import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { AdminStatistics } from '../../models/admin.model';
import { AdminStatisticsPanel } from './admin-statistics';

const STATS: AdminStatistics = {
  from: '2026-10-16',
  to: '2026-11-15',
  total_posts: 10,
  by_type: { lost: 6, found: 4 },
  by_status: { pending: 3, approved: 5, rejected: 1, resolved: 1 },
  posts_by_type_and_status: {
    lost: { pending: 2, approved: 3, rejected: 1, resolved: 0 },
    found: { pending: 1, approved: 2, rejected: 0, resolved: 1 },
  },
  resolved_count: 2,
  average_days_to_resolution: 5,
  open_reports: 3,
  banned_users: 1,
};

describe('AdminStatisticsPanel', () => {
  const url = `${environment.apiBaseUrl}/admin/statistics`;

  let fixture: ComponentFixture<AdminStatisticsPanel>;
  let component: AdminStatisticsPanel;
  let httpMock: HttpTestingController;

  const setup = (stats: AdminStatistics = STATS) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminStatisticsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne((request) => request.url === url).flush({ data: stats });
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => httpMock.verify());

  it('shows the headline figures', () => {
    setup();

    expect(text()).toContain('10');
    expect(text()).toContain('Avg days to resolve');
    expect(text()).toContain('Open reports');
  });

  it('works out the resolution rate', () => {
    setup();

    expect(component.resolutionRate()).toBe(20);
  });

  it('avoids dividing by zero when there are no posts', () => {
    setup({ ...STATS, total_posts: 0, resolved_count: 0 });

    expect(component.resolutionRate()).toBeNull();
  });

  it('shows a dash when nothing has been resolved yet', () => {
    setup({ ...STATS, average_days_to_resolution: null });

    expect(text()).toContain('—');
  });

  it('turns the status and type maps into rows', () => {
    setup();

    expect(component.statusRows()).toEqual([
      { status: 'pending', count: 3 },
      { status: 'approved', count: 5 },
      { status: 'rejected', count: 1 },
      { status: 'resolved', count: 1 },
    ]);
    expect(component.typeRows()).toEqual([
      { type: 'lost', count: 6 },
      { type: 'found', count: 4 },
    ]);
  });

  it('scales each bar against the largest value in its group', () => {
    setup();

    const rows = component.statusRows();

    expect(component.barWidth(5, rows)).toBe('100%');
    expect(component.barWidth(1, rows)).toBe('20%');
  });

  it('does not divide by zero when every value is zero', () => {
    setup();

    expect(component.barWidth(0, [{ count: 0 }])).toBe('0%');
  });

  it('passes the chosen window as query parameters', () => {
    setup();

    component.from.set('2026-11-01');
    component.to.set('2026-11-10');
    component.load();

    const request = httpMock.expectOne(
      (req) => req.url === url && req.params.get('from') === '2026-11-01',
    );

    expect(request.request.params.get('to')).toBe('2026-11-10');
    request.flush({ data: STATS });
  });

  it('omits the window when the dates are cleared', () => {
    setup();

    component.from.set('');
    component.to.set('');
    component.load();

    const request = httpMock.expectOne((req) => req.url === url);

    expect(request.request.params.has('from')).toBe(false);
    request.flush({ data: STATS });
  });

  it('prefills the inputs with month-to-date before the first response', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminStatisticsPanel);
    component = fixture.componentInstance;

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const expectedFrom = `${now.getFullYear()}-${month}-01`;

    // Asserted before the request is flushed, so this is the local default
    // rather than anything the response supplied.
    expect(component.from()).toBe(expectedFrom);
    expect(component.to()).toBe(
      `${now.getFullYear()}-${month}-${String(now.getDate()).padStart(2, '0')}`,
    );

    fixture.detectChanges();
    httpMock.expectOne((request) => request.url === url).flush({ data: STATS });
  });

  it('sends the prefilled window on the first request', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminStatisticsPanel);
    fixture.detectChanges();

    const request = httpMock.expectOne((req) => req.url === url);

    expect(request.request.params.has('from')).toBe(true);
    expect(request.request.params.has('to')).toBe(true);
    request.flush({ data: STATS });
  });

  it('re-syncs the inputs to the window the response reports', () => {
    setup();

    // STATS covers 2026-10-16 to 2026-11-15, not month-to-date.
    expect(component.from()).toBe('2026-10-16');
    expect(component.to()).toBe('2026-11-15');
  });

  it('shows the synced window in the date inputs', () => {
    setup();

    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="date"]',
    );

    expect(inputs[0].value).toBe('2026-10-16');
    expect(inputs[1].value).toBe('2026-11-15');
  });

  it('builds the cross-tab with a total per type', () => {
    setup();

    expect(component.statusKeys()).toEqual(['pending', 'approved', 'rejected', 'resolved']);
    expect(component.matrixRows()).toEqual([
      { type: 'lost', cells: [2, 3, 1, 0], total: 6 },
      { type: 'found', cells: [1, 2, 0, 1], total: 4 },
    ]);
  });

  it('totals each status column across every type', () => {
    setup();

    expect(component.columnTotals()).toEqual([3, 5, 1, 1]);
  });

  it('treats a type missing from the cross-tab as zero rather than crashing', () => {
    setup({ ...STATS, posts_by_type_and_status: { lost: { approved: 6 } } });

    expect(component.matrixRows()).toEqual([
      { type: 'lost', cells: [0, 6, 0, 0], total: 6 },
      { type: 'found', cells: [0, 0, 0, 0], total: 0 },
    ]);
  });

  it('renders the cross-tab table', () => {
    setup();

    const table = (fixture.nativeElement as HTMLElement).querySelector('.matrix-table');

    expect(table).not.toBeNull();
    // Header, one row per type, and the totals row.
    expect(table!.querySelectorAll('tr').length).toBe(4);
    expect(table!.querySelector('tfoot')!.textContent).toContain('All');
  });

  it('applies the window without letting the browser submit the form', () => {
    setup();

    const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);

    // A native submit navigates and restarts the app, which is what dropped the
    // moderation panel back onto its first tab. (ngSubmit) does not prevent it
    // unless a forms module is imported, so the handler is on (submit).
    expect(submit.defaultPrevented).toBe(true);

    httpMock.expectOne((request) => request.url === url).flush({ data: STATS });
  });

  it('says so when the figures cannot be loaded', () => {
    setup();

    component.load();
    httpMock
      .expectOne((req) => req.url === url)
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.loadError()).toBe('Could not load the figures. Please try again.');
  });
});
