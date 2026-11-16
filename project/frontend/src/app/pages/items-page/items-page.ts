import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Category, Item } from '../../models/models';
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

  // Signals, so the page redraws when HTTP responses arrive (components are
  // OnPush by default and the app runs without zone.js)
  readonly items = signal<Item[]>([]);
  readonly selectedType = signal<ItemTypeFilter>('all');
  readonly loadError = signal('');

  readonly categories = signal<Category[]>([]);
  /** `null` means all categories. */
  readonly selectedCategoryId = signal<number | null>(null);

  isCreatePostOpen = false;
  isMessengerOpen = false;

  readonly filteredItems = computed(() => {
    const type = this.selectedType();
    const categoryId = this.selectedCategoryId();

    return this.items().filter(
      (item) =>
        (type === 'all' || item.type === type) &&
        (categoryId === null || item.category?.id === categoryId),
    );
  });

  ngOnInit(): void {
    this.loadPosts();
    this.loadCategories();
  }

  loadPosts(): void {
    this.loadError.set('');

    this.postService.getPosts().subscribe({
      next: (response) => {
        this.items.set(response.data as Item[]);
      },
      error: (error) => {
        console.error('Failed to fetch posts:', error);
        this.loadError.set('Failed to load items. Please try again.');
      },
    });
  }

  /**
   * Fills the category filter from the same list the create-post form uses. If
   * it fails, the filter keeps only "All categories" and the items still show.
   */
  loadCategories(): void {
    this.postService.getCategories().subscribe({
      next: (response) => {
        this.categories.set(response.data);
      },
      error: (error) => {
        console.error('Failed to load categories:', error);
        this.categories.set([]);
      },
    });
  }

  selectType(type: ItemTypeFilter): void {
    this.selectedType.set(type);
  }

  selectCategory(value: string): void {
    this.selectedCategoryId.set(value === '' ? null : Number(value));
  }

  resetFilters(): void {
    this.selectedType.set('all');
    this.selectedCategoryId.set(null);
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
