import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';
import { VerifyEmailNotice } from '../verify-email-notice/verify-email-notice';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, VerifyEmailNotice],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly displayName = this.auth.displayName;
  readonly isExportingData = signal(false);
  readonly exportError = signal<string | null>(null);

  downloadPersonalData(): void {
    this.isExportingData.set(true);
    this.exportError.set(null);

    this.auth.exportPersonalData().subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'personal-data.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        this.isExportingData.set(false);
      },
      error: () => {
        this.exportError.set('Could not download your data. Please try again.');
        this.isExportingData.set(false);
      },
    });
  }

  logout(): void {
    // The service clears the session even if the request fails, so the feed is
    // always the right place to land.
    this.auth.logout().subscribe(() => this.router.navigate(['/home']));
  }
}
