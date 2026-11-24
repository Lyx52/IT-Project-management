import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { Terms } from './terms';

describe('Terms', () => {
  let fixture: ComponentFixture<Terms>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Terms);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.match(() => true);
    httpMock.verify();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  it('shows the terms and the version', () => {
    expect(host().textContent).toContain('Terms of Service');
    // Matches the privacy policy version, which is what accounts record
    expect(host().textContent).toContain(`Version ${environment.privacyPolicyVersion}`);
  });

  it('links across to the privacy policy', () => {
    const link = host().querySelector<HTMLAnchorElement>('.terms-crosslink a');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/privacy');
  });

  it('offers nothing to accept', () => {
    // Reading the terms is not agreeing to them: consent is recorded by the
    // checkbox on the registration form.
    const page = host().querySelector('.terms-container')!;

    // Scoped to the document itself: the header above it has its own buttons.
    expect(page.querySelector('.acceptance-button')).toBeNull();
    expect(page.querySelectorAll('button')).toHaveLength(0);
  });

  it('keeps the authored line breaks in the guide', () => {
    const text = host().querySelector<HTMLElement>('.terms-text')!;

    // pre-line, or the numbered steps run together into one paragraph
    expect(getComputedStyle(text).whiteSpace).toBe('pre-line');
  });
});
