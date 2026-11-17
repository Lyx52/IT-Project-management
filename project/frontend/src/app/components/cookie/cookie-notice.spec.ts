import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { COOKIE_NOTICE_KEY, CookieNotice } from './cookie-notice';

describe('CookieNotice', () => {
  const render = () => {
    const fixture = TestBed.createComponent(CookieNotice);
    fixture.detectChanges();
    return fixture;
  };

  const notice = (fixture: ReturnType<typeof render>): HTMLElement | null =>
    fixture.nativeElement.querySelector('.cookie-notice');

  afterEach(() => localStorage.clear());

  it('shows the notice to a first-time visitor', () => {
    expect(notice(render())).not.toBeNull();
  });

  it('does not count as dismissed just because it was shown', () => {
    render();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBeNull();

    // A reload before clicking Close still shows it
    expect(notice(render())).not.toBeNull();
  });

  it('hides on Close and stays hidden on the next visit', async () => {
    const fixture = render();
    (fixture.nativeElement.querySelector('.cookie-notice-close') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notice(fixture)).toBeNull();
    expect(localStorage.getItem(COOKIE_NOTICE_KEY)).toBe('true');
    expect(notice(render())).toBeNull();
  });
});
