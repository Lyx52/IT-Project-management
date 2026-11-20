import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Footer } from './footer';

describe('Footer', () => {
  let fixture: ComponentFixture<Footer>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  const links = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'));

  it('links to both the terms and the privacy policy', () => {
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/terms', '/privacy']);
  });

  it('uses real links, so they can be focused, opened in a tab or copied', () => {
    // These were <a (click)> with no href: not reachable by keyboard, and not
    // a link as far as the browser was concerned.
    for (const link of links()) {
      expect(link.getAttribute('href')).toBeTruthy();
    }

    expect(links()).toHaveLength(2);
  });

  it('names the links', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Terms of Service');
    expect(text).toContain('Privacy Policy');
  });
});
