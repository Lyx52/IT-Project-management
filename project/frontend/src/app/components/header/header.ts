import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';
import { VerifyEmailNotice } from '../verify-email-notice/verify-email-notice';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, VerifyEmailNotice],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  texts = en;

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly displayName = this.auth.displayName;

  logout(): void {
    // The service clears the session even if the request fails, so the feed is
    // always the right place to land.
    this.auth.logout().subscribe(() => this.router.navigate(['/home']));
  }
}
