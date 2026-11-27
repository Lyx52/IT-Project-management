import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreatePost } from '../../components/create-post/create-post';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { MessengerLauncher } from '../../components/messenger-launcher/messenger-launcher';
import { ItemCard } from '../../components/item-card/item-card';
import { Item, PageMeta } from '../../models/models';
import { PostService } from '../../services/posts.service';

/** The signed-in user's posts in every status, each linking to its possible matches. */
@Component({
  selector: 'app-my-posts-page',
  imports: [Header, Footer, ItemCard, CreatePost, MessengerLauncher, RouterLink],
  templateUrl: './my-posts-page.html',
})
export class MyPostsPage {
  private readonly postService = inject(PostService);

  readonly posts = signal<Item[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');

  readonly hasMore = computed(() => {
    const meta = this.meta();
    return meta !== null && meta.current_page < meta.last_page;
  });

  constructor() {
    this.load();
  }

  /** A new post lands here in 'pending', so the list is reloaded to show it. */
  onPostCreated(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.postService.getMyPosts().subscribe({
      next: (page) => {
        this.posts.set(page.data);
        this.meta.set(page.meta);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load your posts. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  loadMore(): void {
    const meta = this.meta();

    if (!meta || this.isLoadingMore()) {
      return;
    }

    this.isLoadingMore.set(true);

    this.postService.getMyPosts(meta.current_page + 1).subscribe({
      next: (page) => {
        const shown = new Set(this.posts().map((post) => post.id));
        this.posts.update((posts) => [
          ...posts,
          ...page.data.filter((post) => !shown.has(post.id)),
        ]);
        this.meta.set(page.meta);
        this.isLoadingMore.set(false);
      },
      error: () => this.isLoadingMore.set(false),
    });
  }
}
