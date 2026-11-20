import { Component, inject, signal } from '@angular/core';
import { Messenger } from '../messenger/messenger';
import { AuthService } from '../../services/auth';

/**
 * The floating messenger button and its popup.
 *
 * One component rather than the same markup on every page: the button, the
 * unread badge and the popup were duplicated per page and had already drifted
 * apart. It is a personal inbox, so it is only offered to a signed-in user -
 * reaching a poster starts from Contact on a post, which prompts sign-in.
 */
@Component({
  selector: 'app-messenger-launcher',
  imports: [Messenger],
  templateUrl: './messenger-launcher.html',
  styleUrl: './messenger-launcher.scss',
})
export class MessengerLauncher {
  private readonly auth = inject(AuthService);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly isOpen = signal(false);
  readonly unreadCount = signal(0);

  toggle(): void {
    this.isOpen.update((open) => !open);
  }
}
