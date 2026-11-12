import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth';

/** Public endpoints: sending a token would be meaningless or harmful. */
const NO_TOKEN = ['/login', '/register'];

/**
 * Endpoints whose 401 must not bounce the user to the sign-in page.
 * `/login` answers 401 for wrong credentials, and `/logout` answers 401 for a
 * token the server already considers gone, which is the outcome we wanted.
 */
const NO_REDIRECT = ['/login', '/register', '/logout'];

const matches = (url: string, paths: string[]): boolean =>
  paths.some((path) => new URL(url, 'http://localhost').pathname.endsWith(path));

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token();
  const request =
    token && !matches(req.url, NO_TOKEN)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // The token was revoked, expired or never valid: drop it and ask again.
      if (error.status === 401 && !matches(req.url, NO_REDIRECT)) {
        auth.clear();
        router.navigate(['/login'], { queryParams: { expired: 1 } });
      }

      return throwError(() => error);
    }),
  );
};
