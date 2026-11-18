import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Item } from '../../models/models';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';
import { Footer } from '../../components/footer/footer';
import en from '../../../assets/en.json';
import { PostService } from '../../services/posts.service';
import { CreatePost } from '../../components/create-post/create-post';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ItemForm, ItemCard, Messenger, Header, Footer, CreatePost],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePageComponent {
  private readonly postService = inject(PostService);

  // Signals, so the page redraws when the posts arrive (components are OnPush
  // by default and the app runs without zone.js)
  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly unreadMessagesCount = signal(0);

  texts = en;

  ngOnInit() {
    this.loadPosts();
  }
  isCreatePostOpen = false;
  isMessengerOpen = false;

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

  onPostCreated(): void {
    this.loadPosts();
  }

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }
  constructor(private router: Router) {}

  /** The search itself runs on the Items page, which keeps it in the URL. */
  search(query: string): void {
    const q = query.trim();
    this.router.navigate(['/items'], { queryParams: q ? { q } : {} });
  }

  openTerms() {
    this.router.navigate(['/terms']);
  }
}
