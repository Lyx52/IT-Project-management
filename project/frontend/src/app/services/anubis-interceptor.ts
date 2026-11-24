import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { isApiRequest } from './auth-interceptor';

/**
 * Reloads the page. A token so tests can replace it.
 */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});

/** sessionStorage key holding when this tab last reloaded for Anubis. */
export const RELOADED_AT_KEY = 'findit.anubisReloadedAt';

/** A second challenge this soon after a reload means reloading won't help. */
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * The API only ever answers with JSON or files, never HTML. An HTML answer
 * comes from Anubis (docker/prod/anubis/), the bot filter in front of the
 * site: the browser's "challenge solved" cookie expired or no longer matches
 * (it is tied to the visitor's IP), so Anubis sent its challenge page instead
 * of passing the request on. It does that with status 200, which Angular
 * reports as a JSON parse error, or, for blob and text requests, as success.
 */
const isChallengePage = (headers: HttpHeaders): boolean =>
  headers.get('Content-Type')?.toLowerCase().startsWith('text/html') ?? false;

const reloadedRecently = (): boolean => {
  try {
    const at = Number(sessionStorage.getItem(RELOADED_AT_KEY));

    return at > 0 && Date.now() - at < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
};

const markReloaded = (): void => {
  try {
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the reload still happens, just without loop protection
  }
};

/**
 * Reloads the page when an API call gets Anubis's challenge. The full page
 * load shows the challenge, which takes a second to solve and then returns
 * to the same URL with a fresh cookie, and the app carries on.
 *
 * At most once per 30 seconds per tab: if the reload didn't help (e.g.
 * Anubis is misconfigured), the request fails normally instead of looping.
 */
export const anubisInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const reload = inject(PAGE_RELOAD);
  const handle = (headers: HttpHeaders): void => {
    if (isChallengePage(headers) && !reloadedRecently()) {
      markReloaded();
      reload();
    }
  };

  return next(req).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse) {
        handle(event.headers);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.headers) {
        handle(error.headers);
      }

      return throwError(() => error);
    }),
  );
};
