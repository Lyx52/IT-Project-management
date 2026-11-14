import { Component, inject } from '@angular/core';
import { Item } from '../../models/models';
import { ItemForm } from '../../components/item-form/item-form';
import { ItemCard } from '../../components/item-card/item-card';
import { Messenger } from '../../components/messenger/messenger';
import { Header } from '../../components/header/header';
import { MOCK_ITEMS } from '../../models/mock-items';
import { PostService } from '../../services/posts.service';
import { CreatePost } from '../../components/create-post/create-post';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [ItemForm, ItemCard, Messenger, Header, CreatePost],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePageComponent {
 private readonly postService = inject(PostService);

  items: Item[] = [];

  isLoading = false;
  loadError = '';
  isMessengerOpen = false;

  ngOnInit(): void {
    this.loadPosts();
  }

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

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }
}
