import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { AuthUser } from '../../models/auth.model';
import { Messenger } from './messenger';

const USER: AuthUser = {
  id: 7,
  username: 'jane_doe',
  email: 'jane@example.com',
  email_verified_at: null,
  role: 'user' as const,
  must_verify_email: false,
};

describe('Messenger', () => {
  const url = `${environment.apiBaseUrl}/messages/conversations`;

  let fixture: ComponentFixture<Messenger>;
  let httpMock: HttpTestingController;

  const setup = (signedIn: boolean) => {
    if (signedIn) {
      localStorage.setItem('findit.token', 'stored-token');
      localStorage.setItem('findit.user', JSON.stringify(USER));
    }

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Messenger);
    fixture.detectChanges();
  };

  /**
   * timer(0, ...) emits on a macrotask, so without this the assertions run
   * before the first poll would have happened - and "no request was made"
   * would pass whether or not the guard works.
   */
  const afterFirstPoll = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads conversations for a signed-in user', async () => {
    setup(true);
    await afterFirstPoll();

    httpMock.expectOne(url).flush({ data: [] });
  });

  it('does not call the signed-in endpoint while signed out', async () => {
    setup(false);
    await afterFirstPoll();

    // /messages/conversations answers 401 without a token, and the auth
    // interceptor turns an unexpected 401 into a redirect to /login. Polling it
    // while signed out is what bounced visitors off the home page, which mounts
    // this component whether or not the popup is open.
    httpMock.expectNone(url);
  });

  it('reports a zero unread count while signed out', async () => {
    setup(false);
    await afterFirstPoll();

    expect(fixture.componentInstance.conversations()).toEqual([]);
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });
});
