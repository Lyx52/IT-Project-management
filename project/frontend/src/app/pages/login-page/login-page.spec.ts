import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';
import { LoginPageComponent } from './login-page';

const CREDENTIALS = { email: 'jane@example.com', password: 'correct horse' };

const USER = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
};

const GENERIC_ERROR = 'Those credentials do not match our records.';

describe('LoginPageComponent', () => {
  const url = `${environment.apiBaseUrl}/login`;

  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const setup = (queryParams: Params = {}) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** Fills in valid credentials, submits, and hands back the pending request. */
  const submitValid = () => {
    component.form.patchValue(CREDENTIALS);
    component.submit();
    return httpMock.expectOne(url);
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('validation', () => {
    it('sends no request while the form is empty', () => {
      setup();

      component.submit();

      httpMock.expectNone(url);
      expect(component.error('email')).toBe('Enter your e-mail address.');
      expect(component.error('password')).toBe('Enter your password.');
    });

    it('rejects a malformed e-mail address', () => {
      setup();
      const control = component.form.controls.email;
      control.setValue('not-an-address');
      control.markAsDirty();

      expect(component.error('email')).toBe('Enter a valid e-mail address.');
    });

    it('does not impose a password length rule, which is the backend’s business', () => {
      setup();
      component.form.patchValue({ email: 'jane@example.com', password: 'x' });

      expect(component.form.valid).toBe(true);
    });
  });

  describe('signing in', () => {
    it('posts the credentials and signs the user in', () => {
      setup();

      const request = submitValid();
      expect(request.request.body).toEqual({ ...CREDENTIALS, device_name: 'web' });
      request.flush({ access_token: '4|token', token_type: 'Bearer', user: USER });

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.displayName()).toBe('jane_doe');
    });

    it('goes to the feed when nothing else was requested', () => {
      setup();

      submitValid().flush({ access_token: '4|token', token_type: 'Bearer', user: USER });

      expect(navigateByUrl).toHaveBeenCalledWith('/home');
    });

    it('returns the user to the page the guard blocked', () => {
      setup({ returnUrl: '/items?type=lost' });

      submitValid().flush({ access_token: '4|token', token_type: 'Bearer', user: USER });

      expect(navigateByUrl).toHaveBeenCalledWith('/items?type=lost');
    });

    it('clears the busy state once the request settles', () => {
      setup();

      submitValid().flush({ access_token: '4|token', token_type: 'Bearer', user: USER });

      expect(component.submitting()).toBe(false);
    });
  });

  describe('rejected credentials', () => {
    it('shows one general message for the 422 the backend actually returns', () => {
      setup();

      submitValid().flush(
        {
          message: 'These credentials do not match our records.',
          errors: { email: ['These credentials do not match our records.'] },
        },
        { status: 422, statusText: 'Unprocessable Content' },
      );

      expect(component.formError()).toBe(GENERIC_ERROR);
      expect(component.error('email')).toBeNull();
      expect(component.error('password')).toBeNull();
    });

    it('shows the same general message for a 401, if the endpoint is tightened later', () => {
      setup();

      submitValid().flush(
        { message: 'Invalid credentials.' },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(component.formError()).toBe(GENERIC_ERROR);
      expect(component.error('email')).toBeNull();
    });

    it('does not sign the user in', () => {
      setup();

      submitValid().flush(
        { message: 'Invalid credentials.' },
        { status: 401, statusText: 'Unauthorized' },
      );

      expect(auth.isAuthenticated()).toBe(false);
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });

  describe('other failures', () => {
    it('relays the reason a banned account was refused', () => {
      setup();

      submitValid().flush(
        { message: 'This account has been banned.' },
        { status: 403, statusText: 'Forbidden' },
      );

      expect(component.formError()).toBe('This account has been banned.');
    });

    it('falls back to its own wording when a 403 carries no message', () => {
      setup();

      submitValid().flush(null, { status: 403, statusText: 'Forbidden' });

      expect(component.formError()).toBe('This account has been banned.');
    });

    it('explains a 429 from the throttle', () => {
      setup();

      submitValid().flush(
        { message: 'Too Many Attempts.' },
        { status: 429, statusText: 'Too Many Requests' },
      );

      expect(component.formError()).toBe(
        'Too many sign-in attempts. Please wait a minute and try again.',
      );
    });

    it('explains an unreachable server', () => {
      setup();

      submitValid().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.formError()).toBe(
        'Could not reach the server. Check your connection and try again.',
      );
    });

    it('reports a 500 as a server problem, not a credentials problem', () => {
      setup();

      submitValid().flush(
        { message: 'Server Error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(component.formError()).toBe(
        'Something went wrong while signing you in. Please try again.',
      );
    });
  });

  describe('expired session notice', () => {
    it('explains why the user was sent back here', () => {
      setup({ expired: '1' });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(component.sessionExpired).toBe(true);
      expect(text).toContain('Your session has expired');
    });

    it('stays hidden on a normal visit', () => {
      setup();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(component.sessionExpired).toBe(false);
      expect(text).not.toContain('Your session has expired');
    });
  });
});
