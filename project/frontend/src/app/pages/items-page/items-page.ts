import { Component, OnInit, inject } from '@angular/core';
import { Item } from '../../models/models';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { ItemForm } from '../../components/item-form/item-form';
import { Messenger } from '../../components/messenger/messenger';
import { PostService } from '../../services/posts.service';

type ItemTypeFilter = 'all' | 'lost' | 'found';

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [Header, ItemCard, ItemForm, Messenger],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPageComponent implements OnInit {
  private readonly postService = inject(PostService);

  items: Item[] = [];
  selectedType: ItemTypeFilter = 'all';
  loadError = '';

  isCreatePostOpen = false;
  isMessengerOpen = false;

  get filteredItems(): Item[] {
    if (this.selectedType === 'all') {
      return this.items;
    }

    return this.items.filter((item) => item.type === this.selectedType);
  }

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(): void {
    this.loadError = '';

    this.postService.getPosts().subscribe({
      next: (response) => {
        this.items = response.data as Item[];
      },
      error: (error) => {
        console.error('Failed to fetch posts:', error);
        this.loadError = 'Failed to load items. Please try again.';
      },
    });
  }

  selectType(type: ItemTypeFilter): void {
    this.selectedType = type;
  }

  onPostCreated(): void {
    this.closeCreatePost();
    this.loadPosts();
  }

  openCreatePost(): void {
    this.isCreatePostOpen = true;
  }

  closeCreatePost(): void {
    this.isCreatePostOpen = false;
  }

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }
}
