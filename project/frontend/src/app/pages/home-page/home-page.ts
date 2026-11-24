import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Item } from '../../models/models';
import { ItemCard } from '../../components/item-card/item-card';
import { MessengerLauncher } from '../../components/messenger-launcher/messenger-launcher';
import { Header } from '../../components/header/header';
import { Footer } from '../../components/footer/footer';
import en from '../../../assets/en.json';
import { AuthService } from '../../services/auth';
import { PostService } from '../../services/posts.service';
import { CreatePost } from '../../components/create-post/create-post';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ItemCard, MessengerLauncher, Header, Footer, CreatePost],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePageComponent {
  private readonly postService = inject(PostService);
  private readonly auth = inject(AuthService);

  /** The messenger is a personal inbox, so it is only offered when signed in. */
  readonly isAuthenticated = this.auth.isAuthenticated;

  // Signals, so the page redraws when the posts arrive (components are OnPush
  // by default and the app runs without zone.js)
  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly searchQuery = signal('');

  texts = en;

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadPosts();
  }

  // Signals like the rest of this component's state: these are flipped from
  // an @Output() raised inside an HTTP callback, which does not mark the view
  // dirty on its own in a zoneless app.
  readonly isCreatePostOpen = signal(false);

  loadPosts(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.postService.getPosts().subscribe({
      next: (response) => {
        this.items.set(response.data as Item[]);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to fetch posts:', error);
        this.loadError.set('Failed to load items. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  readonly filteredItems = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.items();
    }

    return this.items().filter((item) => item.title.toLowerCase().includes(query));
  });

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onPostCreated(): void {
    this.loadPosts();
  }

  /** The search itself runs on the Items page, which keeps it in the URL. */
  search(query: string): void {
    const q = query.trim();
    this.router.navigate(['/items'], { queryParams: q ? { q } : {} });
  }
}
