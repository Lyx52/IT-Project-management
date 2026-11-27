import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { AdminCategory } from '../../models/admin.model';
import { AdminCategories } from './admin-categories';

const IN_USE: AdminCategory = { id: 1, name: 'Phones', retired_at: null, posts_count: 4 };
const UNUSED: AdminCategory = { id: 2, name: 'Bikes', retired_at: null, posts_count: 0 };
const RETIRED: AdminCategory = {
  id: 3,
  name: 'Old thing',
  retired_at: '2026-11-01T00:00:00Z',
  posts_count: 2,
};

describe('AdminCategories', () => {
  const base = `${environment.apiBaseUrl}/admin/categories`;

  let fixture: ComponentFixture<AdminCategories>;
  let component: AdminCategories;
  let httpMock: HttpTestingController;

  const setup = (categories: AdminCategory[] = [IN_USE, UNUSED, RETIRED]) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(base).flush({ data: categories });
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => httpMock.verify());

  it('creates a category without letting the browser submit the form', () => {
    setup();

    component.newName.set('Bicycles');
    fixture.detectChanges();

    const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);

    // Without preventDefault the page reloads instead of posting.
    expect(submit.defaultPrevented).toBe(true);

    const request = httpMock.expectOne((req) => req.url === base && req.method === 'POST');
    request.flush({ data: { ...UNUSED, name: 'Bicycles' } });
    httpMock.expectOne(base).flush({ data: [IN_USE, UNUSED, RETIRED] });
  });

  it('lists categories with their post counts', () => {
    setup();

    expect(text()).toContain('Phones');
    expect(text()).toContain('Bikes');
  });

  it('offers delete only for a category nothing uses', () => {
    setup();

    expect(component.canDelete(UNUSED)).toBe(true);
    // A category posts reference can only be retired, or those posts lose it.
    expect(component.canDelete(IN_USE)).toBe(false);
    expect(component.canDelete(RETIRED)).toBe(false);
  });

  it('marks a retired category', () => {
    setup();

    expect(component.isRetired(RETIRED)).toBe(true);
    expect(component.isRetired(IN_USE)).toBe(false);
    expect(text()).toContain('retired');
  });

  it('creates a category and reloads', () => {
    setup();

    component.newName.set('Bicycles');
    component.create();

    const request = httpMock.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Bicycles' });
    request.flush({ data: { id: 4, name: 'Bicycles', retired_at: null, posts_count: 0 } });

    httpMock.expectOne(base).flush({ data: [] });
    expect(component.newName()).toBe('');
  });

  it('ignores an empty new name', () => {
    setup();

    component.newName.set('   ');
    component.create();

    httpMock.expectNone(base);
  });

  it('surfaces a duplicate-name error from the backend', () => {
    setup();

    component.newName.set('Phones');
    component.create();

    httpMock
      .expectOne(base)
      .flush(
        { message: 'invalid', errors: { name: ['The name has already been taken.'] } },
        { status: 422, statusText: 'Unprocessable Content' },
      );

    expect(component.actionError()).toBe('The name has already been taken.');
  });

  it('renames through PATCH', () => {
    setup();

    component.startRename(IN_USE);
    component.editingName.set('Mobile phones');
    component.confirmRename(IN_USE);

    const request = httpMock.expectOne(`${base}/1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Mobile phones' });
    request.flush({ data: IN_USE });

    httpMock.expectOne(base).flush({ data: [] });
  });

  it('skips the request when the name was not actually changed', () => {
    setup();

    component.startRename(IN_USE);
    component.editingName.set('Phones');
    component.confirmRename(IN_USE);

    httpMock.expectNone(`${base}/1`);
    expect(component.editingId()).toBeNull();
  });

  it('retires a live category and restores a retired one', () => {
    setup();

    component.toggleRetired(IN_USE);
    httpMock.expectOne(`${base}/1/retire`).flush({});
    httpMock.expectOne(base).flush({ data: [] });

    component.toggleRetired(RETIRED);
    httpMock.expectOne(`${base}/3/restore`).flush({});
    httpMock.expectOne(base).flush({ data: [] });
  });

  it('explains when the backend refuses to delete one in use', () => {
    setup();

    component.remove(IN_USE);
    httpMock
      .expectOne(`${base}/1`)
      .flush(
        { message: 'This category is used by existing posts. Retire it instead.' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    httpMock.expectOne(base).flush({ data: [] });

    expect(component.actionError()).toBe(
      'This category is used by existing posts. Retire it instead.',
    );
  });
});
