import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { MessengerLauncher } from './messenger-launcher';

const API = environment.apiBaseUrl;

describe('MessengerLauncher', () => {
  let fixture: ComponentFixture<MessengerLauncher>;
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
    fixture = TestBed.createComponent(MessengerLauncher);
    fixture.detectChanges();
  };

  const query = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    httpMock.match(`${API}/messages/conversations`);
    httpMock.verify();
    localStorage.clear();
  });

  it('shows nothing to a signed-out visitor', () => {
    render();

    expect(query('.messenger-button')).toBeNull();
    expect(query('app-messenger')).toBeNull();
  });

  it('offers the button once signed in', () => {
    signIn();
    render();

    expect(query('.messenger-button')).not.toBeNull();
  });

  it('keeps the popup mounted but hidden while closed, so the badge stays current', () => {
    signIn();
    render();

    const popup = query('.messenger-popup') as HTMLElement;

    expect(popup).not.toBeNull();
    expect(popup.hasAttribute('hidden')).toBe(true);
    expect(query('app-messenger')).not.toBeNull();
  });

  it('opens and closes on the button', () => {
    signIn();
    render();

    const button = query('.messenger-button') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect((query('.messenger-popup') as HTMLElement).hasAttribute('hidden')).toBe(false);

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the unread count, capped at 99+', () => {
    signIn();
    render();

    fixture.componentInstance.unreadCount.set(5);
    fixture.detectChanges();
    expect(query('.messenger-unread-badge')!.textContent?.trim()).toBe('5');

    fixture.componentInstance.unreadCount.set(150);
    fixture.detectChanges();
    expect(query('.messenger-unread-badge')!.textContent?.trim()).toBe('99+');

    fixture.componentInstance.unreadCount.set(0);
    fixture.detectChanges();
    expect(query('.messenger-unread-badge')).toBeNull();
  });
});
