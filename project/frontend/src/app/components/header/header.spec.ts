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

  it('shows the username of the signed-in user', () => {
    setup(true);

    expect(text()).toContain('jane_doe');
    expect(text()).toContain('Log out');
    expect(text()).not.toContain('Sign up');
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
