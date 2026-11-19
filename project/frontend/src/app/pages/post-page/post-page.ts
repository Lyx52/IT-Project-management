import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { Item } from '../../models/models';
import { AuthService } from '../../services/auth';
import { PostService } from '../../services/posts.service';
import { Messenger } from '../../components/messenger/messenger';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * One post. Its author also sees the posts that might be its other half
 * (opposite type, same category, within 7 days and 2 km), so they don't have
 * to search themselves.
 */
@Component({
  selector: 'app-post-page',
  imports: [Header, Footer, ItemCard, RouterLink, DatePipe, Messenger],
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

  readonly matches = signal<Item[]>([]);
  readonly matchesState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly isResolving = signal(false);

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

  readonly unreadMessagesCount = signal(0);

  isMessengerOpen = false;

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }

  load(): void {
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    this.post.set(null);
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

  openTerms(): void {
    this.router.navigate(['/terms']);
  }
  closepostevent(): void {
    const post = this.post();

    if (!post || !this.isMine() || post.status === 'resolved' || this.isResolving()) {
      return;
    }

    this.isResolving.set(true);

    this.subscriptions.add(
      this.postService.closePost(this.postId).subscribe({
        next: () => {
          this.post.update((current) => (current ? { ...current, status: 'resolved' } : current));
          this.isResolving.set(false);
          alert('Post has been resolved successfully.');
          this.router.navigate(['/my-posts']);
        },
        error: (error: HttpErrorResponse) => {
          this.isResolving.set(false);
          console.error('Failed to resolve post:', error);
          alert('Failed to resolve post. Please try again.');
        },
      }),
    );
  }
}
