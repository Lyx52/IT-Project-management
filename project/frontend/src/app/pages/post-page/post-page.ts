import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { CreatePost } from '../../components/create-post/create-post';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { ItemForm } from '../../components/item-form/item-form';
import { MessengerLauncher } from '../../components/messenger-launcher/messenger-launcher';
import { ReportPost } from '../../components/report-post/report-post';
import { Item } from '../../models/models';
import { AuthService } from '../../services/auth';
import { PostService } from '../../services/posts.service';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * One post. Its author also sees the posts that might be its other half
 * (opposite type, same category, within 7 days and 2 km), so they don't have
 * to search themselves.
 */
@Component({
  selector: 'app-post-page',
  imports: [
    Header,
    Footer,
    ItemCard,
    ItemForm,
    CreatePost,
    MessengerLauncher,
    ReportPost,
    RouterLink,
    DatePipe,
  ],
  templateUrl: './post-page.html',
  styleUrl: './post-page.scss',
})
export class PostPage {
  private readonly postService = inject(PostService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly post = signal<Item | null>(null);
  readonly state = signal<LoadState>('loading');

  /** Which photo the carousel is showing. */
  readonly imageIndex = signal(0);

  readonly matches = signal<Item[]>([]);
  readonly matchesState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** The edit modal, offered to the author of a post that is not resolved. */
  readonly isEditing = signal(false);

  readonly isResolving = signal(false);
  readonly resolveError = signal<string | null>(null);

  readonly isMine = computed(() => {
    const post = this.post();
    const user = this.auth.user();
    return post !== null && user !== null && post.user.id === user.id;
  });

  private postId = 0;
  private subscriptions = new Subscription();

  constructor() {
    // Following a match to another post reuses this page, so react to the id
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.postId = Number(params.get('id'));
      this.load();
    });
  }

  load(): void {
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    this.post.set(null);
    this.imageIndex.set(0);
    this.resolveError.set(null);
    this.isEditing.set(false);
    this.matches.set([]);
    this.matchesState.set('idle');

    if (!Number.isInteger(this.postId) || this.postId < 1) {
      this.state.set('not-found');
      return;
    }

    this.state.set('loading');

    this.subscriptions.add(
      this.postService.getPostById(this.postId).subscribe({
        next: (response) => {
          this.post.set(response.data);
          this.state.set('ready');

          if (this.isMine()) {
            this.loadMatches();
          }
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to load post:', error);

          this.state.set(error.status === 404 ? 'not-found' : 'error');
        },
      }),
    );
  }

  openEdit(): void {
    const post = this.post();

    if (!post || !this.isMine() || post.status === 'resolved') {
      return;
    }

    this.isEditing.set(true);
  }

  closeEdit(): void {
    this.isEditing.set(false);
  }

  /**
   * Saving sends the post back to moderation, so the page is reloaded rather
   * than patched: its status, and whether it is public, have both changed.
   */
  onPostEdited(): void {
    this.closeEdit();
    this.load();
  }

  showImage(index: number): void {
    this.imageIndex.set(index);
  }

  /** Wraps, so the arrows never dead-end on the first or last photo. */
  nextImage(count: number): void {
    this.imageIndex.update((index) => (index + 1) % count);
  }

  previousImage(count: number): void {
    this.imageIndex.update((index) => (index - 1 + count) % count);
  }

  onCarouselKey(event: KeyboardEvent, count: number): void {
    if (count < 2) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextImage(count);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previousImage(count);
    }
  }

  /**
   * Nothing on this page changes: a new post starts as pending, and this page
   * shows one specific post.
   */
  onPostCreated(): void {}

  contact(): void {
    const post = this.post();

    if (!post) {
      return;
    }

    if (!this.auth.user()) {
      this.router.navigate(['/login']);
      return;
    }

    this.router.navigate(['/messages', post.id]);
  }

  loadMatches(): void {
    this.matchesState.set('loading');

    this.subscriptions.add(
      this.postService.getMatches(this.postId).subscribe({
        next: (response) => {
          this.matches.set(response.data);
          this.matchesState.set('ready');
        },
        error: () => this.matchesState.set('error'),
      }),
    );
  }

  closepostevent(): void {
    const post = this.post();

    if (!post || !this.isMine() || post.status === 'resolved' || this.isResolving()) {
      return;
    }

    this.isResolving.set(true);
    this.resolveError.set(null);

    this.subscriptions.add(
      this.postService.closePost(this.postId).subscribe({
        next: () => {
          // The page shows the outcome itself: the action is replaced by a
          // "Resolved" badge and the copy above it changes. No dialog needed,
          // and no redirect - being thrown to another page is disorienting
          // when the thing you acted on is right here.
          this.post.update((current) => (current ? { ...current, status: 'resolved' } : current));
          this.isResolving.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.isResolving.set(false);
          console.error('Failed to resolve post:', error);
          this.resolveError.set(
            error.status === 403
              ? 'Only the author can resolve this post.'
              : 'Could not resolve the post. Please try again.',
          );
        },
      }),
    );
  }
}
