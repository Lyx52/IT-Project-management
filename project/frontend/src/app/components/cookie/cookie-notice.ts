import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import en from '../../../assets/en.json';

/** localStorage key set once the visitor has dismissed the notice. */
export const COOKIE_NOTICE_KEY = 'cookieNoticeDismissed';

/**
 * Site-wide cookie notice. Mounted once in the app root so it shows on
 * whichever page the visitor lands on, and stays until they close it.
 */
@Component({
  selector: 'app-cookie-notice',
  imports: [RouterLink],
  templateUrl: './cookie-notice.html',
  styleUrl: './cookie-notice.scss',
})
export class CookieNotice {
  readonly texts = en;
  readonly visible = signal(!CookieNotice.isDismissed());

  closeCookieNotice(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(COOKIE_NOTICE_KEY, 'true');
    } catch {
      // Storage blocked (private mode etc.): hide for this visit only.
    }
  }

  private static isDismissed(): boolean {
    try {
      return localStorage.getItem(COOKIE_NOTICE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
