import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Item } from '../../models/models';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';
import { MOCK_ITEMS } from '../../models/mock-items';
import { Footer } from '../../components/footer/footer';
import { CookieNotice } from '../../components/cookie/cookie-notice';
import en from '../../../assets/en.json';
import lv from '../../../assets/lv.json';
import { PostService } from '../../services/posts.service';
import { CreatePost } from '../../components/create-post/create-post';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ItemForm, ItemCard, Messenger, Header, Footer, CookieNotice, CreatePost],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePageComponent {
  private readonly postService = inject(PostService);

  items: Item[] = [];

  isLoading = false;
  loadError = '';
  cookieVisible = false;
  texts = en;

  ngOnInit() {
    this.loadPosts();
    const alreadyShown = localStorage.getItem('cookieShown');

    if (!alreadyShown) {
      this.cookieVisible = true;
      localStorage.setItem('cookieShown', 'true');
    }
  }
  hidecookie(): void {
    this.cookieVisible = false;
  }
  readonly editingItem = signal<Item | null>(null);
  isCreatePostOpen = false;
  isMessengerOpen = false;

  loadPosts(): void {
    this.isLoading = true;
    this.loadError = '';

    this.postService.getPosts().subscribe({
      next: (response) => {
        this.items = response.data as Item[];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to fetch posts:', error);
        this.loadError = 'Failed to load items. Please try again.';
        this.isLoading = false;
      },
    });
  }

  onPostCreated(): void {
    this.loadPosts();
  }

  openEdit(item: Item): void {
    this.editingItem.set(item);
  }

  closeEdit(): void {
    this.editingItem.set(null);
  }

  onPostEdited(): void {
    this.closeEdit();
    this.loadPosts();
  }

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }
  constructor(private router: Router) {}
  openTerms() {
    this.router.navigate(['/terms']);
  }
}
