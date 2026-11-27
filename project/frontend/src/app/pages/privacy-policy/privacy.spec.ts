import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { PrivacyComponent } from './privacy';

describe('PrivacyComponent', () => {
  let fixture: ComponentFixture<PrivacyComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.match(() => true);
    httpMock.verify();
  });

  const host = () => fixture.nativeElement as HTMLElement;

  it('covers cookies and local storage, which the cookie notice links to', () => {
    expect(host().textContent).toContain('Cookies and Local Storage');
    expect(host().querySelector('#cookies')).not.toBeNull();
  });

  it('shows the version the account actually records', () => {
    // Not a hardcoded string: this is what registration sends as
    // privacy_policy_version and what the backend stores on the user.
    expect(host().querySelector('.privacy-version')!.textContent?.trim()).toBe(
      `Version ${environment.privacyPolicyVersion}`,
    );
  });

  it('links across to the terms', () => {
    const link = host().querySelector<HTMLAnchorElement>('.privacy-crosslink a');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/terms');
  });

  it('offers nothing to accept', () => {
    const page = host().querySelector('.privacy-container')!;

    // Scoped to the document itself: the header above it has its own buttons.
    expect(page.querySelector('.acceptance-button')).toBeNull();
    expect(page.querySelectorAll('button')).toHaveLength(0);
  });

  it('uses the same container as the terms page', () => {
    // The stylesheet used to target .privacy, which the template never used,
    // so none of the width or padding applied.
    expect(host().querySelector('.privacy-container')).not.toBeNull();
  });
});
