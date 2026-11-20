import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('Application', () => {
  afterEach(() => localStorage.clear());

  it('puts the cookie notice above the page, not over it', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const notice = host.querySelector('app-cookie-notice');
    const outlet = host.querySelector('router-outlet');

    expect(notice).not.toBeNull();
    expect(outlet).not.toBeNull();

    // The bottom edge is where the create-post and messenger buttons live, so
    // the notice sits in the flow ahead of the page instead of floating over it.
    expect(
      notice!.compareDocumentPosition(outlet!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
