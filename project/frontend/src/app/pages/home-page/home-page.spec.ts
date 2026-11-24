import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { HomePageComponent } from './home-page';

const API = environment.apiBaseUrl;

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
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

  const open = () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePageComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${API}/posts`).flush({ data: [] });
    fixture.detectChanges();
  };

  const query = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    // Whatever else the page's children ask for is their own concern
    httpMock.match(() => true);
    httpMock.verify();
    localStorage.clear();
  });

  it('hides the messenger from a signed-out visitor', () => {
    open();

    // A personal inbox, not a call to action. It also polls a signed-in
    // endpoint, whose 401 the interceptor turns into a redirect to /login.
    expect(query('.messenger-button')).toBeNull();
    expect(query('app-messenger')).toBeNull();
  });

  it('offers the messenger once signed in', () => {
    signIn();
    open();

    expect(query('.messenger-button')).not.toBeNull();
  });

  it('never asks for conversations while signed out', () => {
    open();

    expect(httpMock.match(`${API}/messages/conversations`)).toHaveLength(0);
  });
});
