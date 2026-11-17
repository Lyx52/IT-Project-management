import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

/**
 * Public endpoints: sending a token would be meaningless or harmful. A 401
 * from these is about the credentials just submitted, not a dead session, so
 * there is also nothing to sign out of.
 */
const NO_TOKEN = ['/login', '/register'];

/**
 * Endpoints whose 401 must not bounce the user to the sign-in page.
 *
 * `/logout` answers 401 for a token the server already considers gone, which
 * is the outcome we wanted. `/user` is called by the startup session check, and
 * dragging someone off a public page over a stale token they never tried to
 * use would be worse than quietly signing them out.
 */
const NO_REDIRECT = ['/login', '/register', '/logout', '/user'];

const matches = (url: string, paths: string[]): boolean =>
  paths.some((path) => new URL(url, 'http://localhost').pathname.endsWith(path));

/**
 * Whether the request goes to our own API. The token is only ever sent there:
 * a request to any other host (map tiles, a geocoder, a CDN) must never carry
 * it, or that host could act as the signed-in user.
 */
const isApiRequest = (url: string): boolean => {
  const base = environment.apiBaseUrl;

  return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  const request =
    token && isApiRequest(req.url) && !matches(req.url, NO_TOKEN)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Signing out and redirecting are separate decisions: a token the
        // server rejects is always dead, but not every rejection should
        // interrupt what the user was doing.
        if (!matches(req.url, NO_TOKEN)) {
          auth.clear();
        }

        if (!matches(req.url, NO_REDIRECT)) {
          router.navigate(['/login'], { queryParams: { expired: 1 } });
        }
      }

      return throwError(() => error);
    }),
  );
};
