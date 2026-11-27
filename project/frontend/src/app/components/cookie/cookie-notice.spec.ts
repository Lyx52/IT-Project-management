import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COOKIE_NOTICE_KEY, CookieNotice } from './cookie-notice';

describe('CookieNotice', () => {
  const render = () => {
    const fixture = TestBed.createComponent(CookieNotice);
    fixture.detectChanges();
    return fixture;
  };

  const notice = (fixture: ReturnType<typeof render>): HTMLElement | null =>
    fixture.nativeElement.querySelector('.cookie-notice');

  beforeEach(() => {
    // RouterLink needs a router, for the link to the privacy policy
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => localStorage.clear());

  it('shows the notice to a first-time visitor', () => {
    expect(notice(render())).not.toBeNull();
  });

  it('does not count as dismissed just because it was shown', () => {
    render();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBeNull();

    // A reload before acknowledging it still shows it
    expect(notice(render())).not.toBeNull();
  });

  it('hides when acknowledged and stays hidden on the next visit', async () => {
    const fixture = render();
    (fixture.nativeElement.querySelector('.cookie-notice-close') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notice(fixture)).toBeNull();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe('true');
    expect(notice(render())).toBeNull();
  });

  it('links to the privacy policy for the detail', () => {
    const host = render().nativeElement as HTMLElement;
    const link = host.querySelector<HTMLAnchorElement>('.cookie-notice-link');

    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/privacy');
  });

  it('claims no consent and offers nothing to reject', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';

    // Everything stored is strictly necessary, so the notice must not imply
    // consent was given, and must not offer a Reject that does nothing.
    expect(text.toLowerCase()).not.toContain('by continuing');
    expect(text.toLowerCase()).not.toContain('you consent');
    expect(text.toLowerCase()).not.toContain('reject');
    expect(text.toLowerCase()).not.toContain('accept all');
  });

  it('is announced as a labelled region', () => {
    const region = notice(render())!;

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-labelledby')).toBe('cookie-notice-title');
    expect(region.querySelector('#cookie-notice-title')).not.toBeNull();
  });
});
