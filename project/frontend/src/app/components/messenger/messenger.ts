import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, timer } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MessagesService } from '../../services/messages.service';
import { PostService } from '../../services/posts.service';
import { AuthService } from '../../services/auth';
import { Conversation } from '../../models/models';

import en from '../../../assets/en.json';

@Component({
  selector: 'app-messenger',
  standalone: true,
  imports: [],
  templateUrl: './messenger.html',
  styleUrl: './messenger.scss',
})
export class Messenger {
  private readonly router = inject(Router);
  private readonly messagesService = inject(MessagesService);
  private readonly postService = inject(PostService);
  private readonly auth = inject(AuthService);

  readonly unreadCountChange = output<number>();

  readonly texts = en;
  readonly conversations = signal<Conversation[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal('');
  readonly openingPostId = signal<number | null>(null);

  constructor() {
    timer(0, 4000)
      .pipe(
        switchMap(() =>
          this.messagesService.getConversations().pipe(
            catchError((error) => {
              console.error('Failed to load conversations:', error);
              this.loadError.set('Failed to load conversations.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.isLoading.set(false);

        if (!response) {
          return;
        }

        this.conversations.set(response.data);

        const unread = response.data.reduce(
          (total, conversation) => total + conversation.unread_count,
          0,
        );

        this.unreadCountChange.emit(unread);
        this.loadError.set('');
      });
  }

  openConversation(conversation: Conversation): void {
    if (this.openingPostId() !== null) {
      return;
    }

    this.openingPostId.set(conversation.post_id);

    this.postService
      .getPostById(conversation.post_id)
      .pipe(
        catchError((error) => {
          console.error('Failed to load conversation post:', error);
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.openingPostId.set(null);

        if (!response) {
          return;
        }

        const post = response.data;
        const currentUserId = this.auth.user()?.id;

        // The post author must identify the visitor using user_id.
        if (post.user.id === currentUserId) {
          this.router.navigate(['/messages', conversation.post_id], {
            queryParams: { userId: conversation.other_user.id },
          });
        } else {
          // Visitors must not pass user_id.
          this.router.navigate(['/messages', conversation.post_id]);
        }
      });
  }

  initials(username: string): string {
    return username
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  preview(conversation: Conversation): string {
    return conversation.last_message.body || 'Attachment';
  }
}
