import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { ReportPost } from './report-post';

const URL = `${environment.apiBaseUrl}/post/5/report`;

describe('ReportPost', () => {
  let fixture: ComponentFixture<ReportPost>;
  let component: ReportPost;
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
        role: 'user',
        must_verify_email: false,
      }),
    );
  };

  const render = () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportPost);
    fixture.componentRef.setInput('postId', 5);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => host().textContent ?? '';
  const query = (selector: string) => host().querySelector(selector);

  /** Opens the modal and fills in a reason. */
  const fill = (reason: string) => {
    component.open();
    component.form.controls.reason.setValue(reason);
    component.form.controls.reason.markAsDirty();
    component.form.controls.reason.markAsTouched();
    fixture.detectChanges();
  };

  beforeEach(() => {
    localStorage.clear();
    signIn();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('refuses a reason under 5 characters without asking the server', () => {
    render();
    fill('spam');

    component.submit();
    fixture.detectChanges();

    // The backend requires min:5; catching it here saves a pointless round trip
    httpMock.expectNone(URL);
    expect(text()).toContain('at least 5 characters');
  });

  it('shows what the server said about the reason, not a generic line', () => {
    render();
    fill('a valid looking reason');

    component.submit();
    httpMock.expectOne(URL).flush(
      {
        message: 'The reason field must be at least 5 characters.',
        errors: { reason: ['The reason field must be at least 5 characters.'] },
      },
      { status: 422, statusText: 'Unprocessable Content' },
    );
    fixture.detectChanges();

    expect(component.submitError()).toBe('The reason field must be at least 5 characters.');
    expect(text()).not.toContain('Please check the reason and try again');
  });

  it('says so when the post was already reported, instead of looking successful', () => {
    render();
    fill('reporting this again');

    component.submit();
    httpMock
      .expectOne(URL)
      .flush(
        { message: 'You have already reported this post.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    // It used to close the modal and show "Reported", which read as success
    // even though no report was created.
    expect(component.isOpen()).toBe(true);
    expect(text()).toContain('You have already reported this post.');
  });

  it('stops offering the form once the post is already reported', () => {
    render();
    fill('reporting this again');

    component.submit();
    httpMock
      .expectOne(URL)
      .flush(
        { message: 'You have already reported this post.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    // Retrying would be refused again, so there is nothing to submit
    expect(query('form')).toBeNull();
    expect(text()).not.toContain('Send report');
  });

  it('marks the post reported after a successful report', () => {
    render();
    fill('this is spam content');

    component.submit();
    httpMock.expectOne(URL).flush({ data: { id: 1 } }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(text()).toContain('Reported');
  });

  it('asks a signed-out visitor to sign in', () => {
    localStorage.clear();
    render();
    component.open();
    fixture.detectChanges();

    expect(text()).toContain('You need an account to report a post.');
    expect(query('form')).toBeNull();
  });
});
