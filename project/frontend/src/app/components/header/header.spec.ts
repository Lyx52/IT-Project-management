import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../../models/auth.model';
import { AuthService } from '../../services/auth';
import { Header } from './header';

const USER: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  must_verify_email: false,
};

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  const setup = (signedIn: boolean) => {
    if (signedIn) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(USER));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // A signed-in header holds the notification bell, which loads on its own
    // (covered in notification-bell.spec.ts)
    httpMock.match(`${environment.apiBaseUrl}/notifications`);
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('offers sign in and sign up to a visitor', () => {
    setup(false);

    expect(text()).toContain('Sign in');
    expect(text()).toContain('Sign up');
    expect(text()).not.toContain('Log out');
  });

  const userButton = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.current-user')!;

  const click = (target: HTMLElement) => {
    target.click();
    fixture.detectChanges();
  };

  it('shows the username of the signed-in user, with the account actions tucked away', () => {
    setup(true);

    expect(text()).toContain('jane_doe');
    expect(text()).not.toContain('Sign up');
    expect(text()).not.toContain('Log out');
    expect(text()).not.toContain('Download my data');
    expect(userButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the account menu from the username', () => {
    setup(true);

    click(userButton());

    expect(userButton().getAttribute('aria-expanded')).toBe('true');
    expect(text()).toContain('Download my data');
    expect(text()).toContain('Log out');

    click(userButton());

    expect(text()).not.toContain('Log out');
  });

  it('folds the page links out on small screens and away again once one is picked', () => {
    setup(false);
    // The test router has no routes, so following a link would reject
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    const toggler = el.querySelector<HTMLButtonElement>('.navbar-toggler')!;
    const nav = el.querySelector<HTMLElement>('#main-nav')!;

    expect(nav.classList).not.toContain('show');
    expect(toggler.getAttribute('aria-expanded')).toBe('false');

    click(toggler);
    expect(nav.classList).toContain('show');
    expect(toggler.getAttribute('aria-expanded')).toBe('true');

    click(nav.querySelector<HTMLAnchorElement>('a.nav-link')!);
    expect(nav.classList).not.toContain('show');
  });

  it('closes the account menu on an outside click or Escape', () => {
    setup(true);

    click(userButton());
    click(document.body);
    expect(text()).not.toContain('Log out');

    click(userButton());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(text()).not.toContain('Log out');
  });

  it('signs out and returns to the feed', () => {
    setup(true);

    component.logout();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/logout`)
      .flush({ message: 'Successfully logged out.' });
    fixture.detectChanges();

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/home']);
    expect(text()).toContain('Sign in');
    expect(text()).not.toContain('jane_doe');
  });
});
