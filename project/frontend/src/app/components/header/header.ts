import { Component, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotificationBell } from '../notification-bell/notification-bell';
import { VerifyEmailNotice } from '../verify-email-notice/verify-email-notice';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, VerifyEmailNotice, NotificationBell],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu(); closeNav()',
  },
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  texts = en;

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isAdmin = this.auth.isAdmin;
  readonly displayName = this.auth.displayName;
  readonly isExportingData = signal(false);
  readonly exportError = signal<string | null>(null);

  /** The page links on small screens, where they fold behind the toggler. */
  readonly isNavOpen = signal(false);

  toggleNav(): void {
    this.isNavOpen.update((open) => !open);
  }

  /** Also called on any click inside the links, so picking a page folds them away. */
  closeNav(): void {
    this.isNavOpen.set(false);
  }

  /** The account menu under the username: data export and log out. */
  readonly isMenuOpen = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  /** Closes the menu when the click lands anywhere outside it. */
  onDocumentClick(event: MouseEvent): void {
    const menu = this.host.nativeElement.querySelector('.user-menu');

    if (this.isMenuOpen() && menu && !menu.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

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
        this.closeMenu();
      },
      error: () => {
        this.exportError.set('Could not download your data. Please try again.');
        this.isExportingData.set(false);
      },
    });
  }

  logout(): void {
    this.closeMenu();
    // The service clears the session even if the request fails, so the feed is
    // always the right place to land.
    this.auth.logout().subscribe(() => this.router.navigate(['/home']));
  }
}
