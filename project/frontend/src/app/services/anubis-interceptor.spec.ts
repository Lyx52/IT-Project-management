import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { PAGE_RELOAD, RELOADED_AT_KEY, anubisInterceptor } from './anubis-interceptor';

const CHALLENGE = '<!doctype html><html><body>Making sure you&#39;re not a bot!</body></html>';
const HTML = { 'Content-Type': 'text/html; charset=utf-8' };

describe('anubisInterceptor', () => {
  const base = environment.apiBaseUrl;

  let http: HttpClient;
  let httpMock: HttpTestingController;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([anubisInterceptor])),
        provideHttpClientTesting(),
        { provide: PAGE_RELOAD, useValue: reload },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  /**
   * In a browser, HTML under a JSON request fails to parse, which Angular
   * reports as an error with status 200. The testing backend doesn't parse
   * bodies, so that error is raised by hand here.
   */
  const challengeAsParseError = (url: string) =>
    httpMock
      .expectOne(url)
      .error(new ProgressEvent('error'), { status: 200, statusText: 'OK', headers: HTML });

  it('reloads when a JSON request fails to parse the challenge page', () => {
    const error = vi.fn();
    http.get(`${base}/posts`).subscribe({ error });

    challengeAsParseError(`${base}/posts`);

    expect(reload).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });

  it('reloads when a text request gets the challenge page', () => {
    http.get(`${base}/posts`, { responseType: 'text' }).subscribe();

    httpMock.expectOne(`${base}/posts`).flush(CHALLENGE, { headers: HTML });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads when a blob download gets the challenge page', () => {
    http.get(`${base}/user/export`, { responseType: 'blob' }).subscribe();

    httpMock
      .expectOne(`${base}/user/export`)
      .flush(new Blob([CHALLENGE], { type: 'text/html' }), { headers: HTML });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('leaves normal JSON responses alone', () => {
    http.get(`${base}/posts`).subscribe();

    httpMock
      .expectOne(`${base}/posts`)
      .flush({ data: [] }, { headers: { 'Content-Type': 'application/json' } });

    expect(reload).not.toHaveBeenCalled();
  });

  it('leaves normal API errors alone', () => {
    http.get(`${base}/posts/1`).subscribe({ error: () => {} });

    httpMock
      .expectOne(`${base}/posts/1`)
      .flush(
        { message: 'Not found' },
        { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'application/json' } },
      );

    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores HTML from other hosts', () => {
    http.get('https://example.com/page', { responseType: 'text' }).subscribe();

    httpMock.expectOne('https://example.com/page').flush(CHALLENGE, { headers: HTML });

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload again right after a reload, so it cannot loop', () => {
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now() - 5_000));
    const error = vi.fn();
    http.get(`${base}/posts`).subscribe({ error });

    challengeAsParseError(`${base}/posts`);

    expect(reload).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('reloads again once the cooldown has passed', () => {
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now() - 60_000));
    http.get(`${base}/posts`).subscribe({ error: () => {} });

    challengeAsParseError(`${base}/posts`);

    expect(reload).toHaveBeenCalledOnce();
    expect(Number(sessionStorage.getItem(RELOADED_AT_KEY))).toBeGreaterThan(Date.now() - 1_000);
  });
});
