import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, of, timer } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, map, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MessengerLauncher } from '../../components/messenger-launcher/messenger-launcher';
import { safetyTips } from '../../components/safetytips/safety-tips';
import { Header } from '../../components/header/header';
import { CreatePost } from '../../components/create-post/create-post';
import { Footer } from '../../components/footer/footer';
import { MessagesService } from '../../services/messages.service';
import { PostService } from '../../services/posts.service';
import { Message, MessageAttachment, Paginated } from '../../models/models';
import { AuthService } from '../../services/auth';
import { ReportUser } from '../../components/report-user/report-user';

interface DisplayMessage {
  id: number;
  body: string | null;
  time: string;
  isMine: boolean;
  attachments: MessageAttachment[];
}

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [
    Header,
    Footer,
    RouterLink,
    DatePipe,
    FormsModule,
    safetyTips,
    CreatePost,
    MessengerLauncher,
    ReportUser
  ],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.scss',
})
export class MessagesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messagesService = inject(MessagesService);
  private readonly postService = inject(PostService);
  private readonly auth = inject(AuthService);

  readonly postId = signal(0);
  readonly userId = signal<number | null>(null);
  readonly reportTargetId = signal<number | null>(null);
  readonly canReportParticipant = computed(() => {
    const targetId = this.reportTargetId();
    const reporterId = this.auth.user()?.id;
    return targetId !== null && reporterId !== undefined && targetId !== reporterId;
  });

  readonly postTitle = signal('Loading post...');
  readonly otherUsername = signal('Conversation');
  readonly otherInitials = signal('?');

  readonly messages = signal<DisplayMessage[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');

  readonly draft = signal('');
  readonly isSending = signal(false);
  readonly sendError = signal('');

  /** Nothing on this page changes: a new post starts in moderation. */
  onPostCreated(): void {}

  /** Whether the safety tips are on screen for this conversation. */
  readonly showSafetyTips = signal(false);

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        map(([params, queryParams]) => {
          const postId = Number(params.get('postId'));
          const userId = Number(queryParams.get('userId'));

          return {
            postId: Number.isInteger(postId) && postId > 0 ? postId : 0,
            userId: Number.isInteger(userId) && userId > 0 ? userId : null,
          };
        }),

        distinctUntilChanged(
          (previous, current) =>
            previous.postId === current.postId && previous.userId === current.userId,
        ),

        tap(({ postId, userId }) => {
          this.postId.set(postId);
          this.showSafetyTips.set(!MessagesPage.hiddenTipsFor().includes(postId));
          this.userId.set(userId);
          this.reportTargetId.set(null);

          this.messages.set([]);
          this.loadError.set('');
          this.sendError.set('');

          this.postTitle.set('Loading post...');
          this.otherUsername.set('Conversation');
          this.otherInitials.set('?');
        }),

        switchMap(({ postId, userId }) => {
          if (!postId) {
            this.loadError.set('Invalid post ID.');
            return of({ post: null, messages: null });
          }

          this.isLoading.set(true);

          // Load post details once.
          const post$ = this.postService.getPostById(postId).pipe(
            map((response) => response.data),
            catchError((error) => {
              console.error('Failed to load post:', error);
              this.postTitle.set(`Post #${postId}`);
              return of(null);
            }),
          );

          // Load messages immediately and refresh every 5 seconds.
          const messages$ = timer(0, 5000).pipe(
            switchMap(() =>
              this.messagesService.getMessages(postId, userId ?? undefined).pipe(
                map((response: Paginated<Message>) => response.data),
                catchError((error) => {
                  console.error('Failed to load messages:', error);
                  this.loadError.set('Failed to load messages. Please try again.');
                  return of(null);
                }),
              ),
            ),
          );

          return combineLatest({
            post: post$,
            messages: messages$,
          });
        }),

        takeUntilDestroyed(),
      )
      .subscribe(({ post, messages }) => {
        if (post) {
          this.postTitle.set(post.title);

          // A visitor is talking to the post author.
          const currentUserId = this.auth.user()?.id;

          if (post.user.id !== currentUserId) {
            this.setOtherUsername(post.user.username);
            this.reportTargetId.set(post.user.id);
          } else {
            this.reportTargetId.set(this.userId());
          }
        }

        // null means that the latest request failed.
        // Keep the messages already displayed.
        if (messages === null) {
          this.isLoading.set(false);
          return;
        }

        this.messages.set(messages.map((message) => this.mapMessage(message)));

        if (messages.length > 0) {
          this.updateConversationDetails(messages[0]);
        }

        this.loadError.set('');
        this.isLoading.set(false);
      });
  }

  private mapMessage(message: Message): DisplayMessage {
    const currentUserId = this.auth.user()?.id;

    return {
      id: message.id,
      body: message.body,
      time: message.created_at,
      isMine: message.sender.id === currentUserId,
      attachments: message.attachments ?? [],
    };
  }

  private updateConversationDetails(message: Message): void {
    const currentUserId = this.auth.user()?.id;

    const otherUser = message.sender.id === currentUserId ? message.receiver : message.sender;

    this.setOtherUsername(otherUser.username);
    this.reportTargetId.set(otherUser.id);
  }

  private setOtherUsername(username: string): void {
    this.otherUsername.set(username);

    this.otherInitials.set(
      username
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    );
  }

  send(): void {
    const body = this.draft().trim();

    if (!body || this.isSending() || !this.postId()) {
      return;
    }

    this.isSending.set(true);
    this.sendError.set('');

    this.messagesService
      .sendMessage(this.postId(), body, this.userId() ?? undefined)
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: (response) => {
          const message = response.data;

          this.messages.update((messages) => [...messages, this.mapMessage(message)]);

          this.updateConversationDetails(message);
          this.draft.set('');
        },
        error: (error) => {
          console.error('Failed to send message:', error);

          this.sendError.set(error.error?.message || 'Failed to send message. Please try again.');
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/post', this.postId()]);
  }

  /**
   * Hides the tips for this conversation only, remembered across reloads. A
   * different conversation means meeting someone new, so they come back.
   */
  hideSafetyTips(): void {
    this.showSafetyTips.set(false);

    const hidden = MessagesPage.hiddenTipsFor();

    if (!hidden.includes(this.postId())) {
      MessagesPage.storeHiddenTips([...hidden, this.postId()].slice(-50));
    }
  }

  private static readonly TIPS_KEY = 'findit.safety-tips-hidden';

  private static hiddenTipsFor(): number[] {
    try {
      const raw = localStorage.getItem(MessagesPage.TIPS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];

      return Array.isArray(parsed)
        ? parsed.filter((id): id is number => typeof id === 'number')
        : [];
    } catch {
      // Storage blocked or corrupt: show the tips, which is the safe default
      return [];
    }
  }

  private static storeHiddenTips(ids: number[]): void {
    try {
      localStorage.setItem(MessagesPage.TIPS_KEY, JSON.stringify(ids));
    } catch {
      // Not fatal: the tips stay hidden for this visit only
    }
  }
}
