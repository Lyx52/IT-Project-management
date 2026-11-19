import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';

import { Category, Item, PageMeta, PostFilters } from '../../models/models';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { ItemCard } from '../../components/item-card/item-card';
import { ItemForm } from '../../components/item-form/item-form';
import { Messenger } from '../../components/messenger/messenger';
import en from '../../../assets/en.json';
import { AuthService } from '../../services/auth';
import { PostService } from '../../services/posts.service';
import { SavedSearchService } from '../../services/saved-searches.service';

type ItemTypeFilter = 'all' | 'lost' | 'found';

const NO_FILTERS: PostFilters = { q: null, type: null, category_id: null };

/** Reads the filters from `?q=…&type=…&category_id=…`, ignoring anything invalid. */
export function filtersFromParams(params: ParamMap): PostFilters {
  const q = params.get('q')?.trim() || null;
  const type = params.get('type');
  const categoryId = Number(params.get('category_id'));

  return {
    q: q ? q.slice(0, 100) : null,
    type: type === 'lost' || type === 'found' ? type : null,
    category_id: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
  };
}

/** The query params for a set of filters; unset ones are left out of the URL. */
export function paramsFromFilters(filters: PostFilters): Record<string, string | number | null> {
  return { q: filters.q || null, type: filters.type, category_id: filters.category_id };
}

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [Header, ItemCard, ItemForm, Messenger, Footer, RouterLink],
  templateUrl: './items-page.html',
  styleUrl: './items-page.scss',
})
export class ItemsPageComponent {
  private readonly postService = inject(PostService);
  private readonly savedSearches = inject(SavedSearchService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  texts = en;
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');

  private readonly searchInput$ = new Subject<string>();

  readonly isAuthenticated = this.auth.isAuthenticated;

  // Signals, so the page redraws when HTTP responses arrive (components are
  // OnPush by default and the app runs without zone.js)

  /** What the list shows. The URL is the source of truth, see the constructor. */
  readonly filters = signal<PostFilters>(NO_FILTERS);
  /** The search box while typing, applied on submit. */
  readonly searchText = signal('');

  readonly items = signal<Item[]>([]);
  readonly meta = signal<PageMeta | null>(null);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly loadError = signal('');

  readonly categories = signal<Category[]>([]);

  readonly selectedType = computed<ItemTypeFilter>(() => this.filters().type ?? 'all');
  readonly selectedCategoryId = computed(() => this.filters().category_id);
  readonly hasFilters = computed(() => {
    const { q, type, category_id } = this.filters();
    return q !== null || type !== null || category_id !== null;
  });
  readonly hasMore = computed(() => {
    const meta = this.meta();
    return meta !== null && meta.current_page < meta.last_page;
  });

  // "Save this search"
  readonly isSaveOpen = signal(false);
  readonly saveName = signal('');
  readonly isSaving = signal(false);
  readonly saveError = signal('');
  readonly savedAs = signal<string | null>(null);

  isCreatePostOpen = false;
  isMessengerOpen = false;

  private loadSubscription?: Subscription;

  constructor() {
    // Links from the home search box and from saved searches land here with
    // their filters in the URL, and the back button steps through searches.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const filters = filtersFromParams(params);

      this.filters.set(filters);
      this.searchText.set(filters.q ?? '');
      this.closeSave();
      this.savedAs.set(null);
      this.loadPosts();
    });

    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.applyFilters({ q: value.trim() || null });
      });

    this.loadCategories();
  }

  readonly filteredItems = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    const order = this.sortOrder();

    return [...this.items()]
      .filter((item) => {
        const date = item.event_date?.slice(0, 10);

        if (!date) return !from && !to;
        if (from && date < from) return false;
        if (to && date > to) return false;

        return true;
      })
      .sort((a, b) => {
        const comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        return order === 'newest' ? comparison : -comparison;
      });
  });

  onSearchInput(value: string): void {
    this.searchText.set(value);
    this.searchInput$.next(value);
  }

  toggleSortOrder(): void {
    this.sortOrder.update((order) => (order === 'newest' ? 'oldest' : 'newest'));
  }

  resetFilters(): void {
    this.searchText.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.sortOrder.set('newest');

    this.searchInput$.next('');
    this.navigateTo(NO_FILTERS);
  }

  loadPosts(): void {
    this.loadSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.isLoadingMore.set(false);
    this.loadError.set('');

    this.loadSubscription = this.postService.searchPosts(this.filters()).subscribe({
      next: (page) => {
        this.items.set(page.data);
        this.meta.set(page.meta);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to fetch posts:', error);
        this.items.set([]);
        this.meta.set(null);
        this.loadError.set('Failed to load items. Please try again.');
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

    this.loadSubscription = this.postService
      .searchPosts(this.filters(), meta.current_page + 1)
      .subscribe({
        next: (page) => {
          // A post can shift onto the next page when a new one is approved
          const shown = new Set(this.items().map((item) => item.id));
          this.items.update((items) => [
            ...items,
            ...page.data.filter((item) => !shown.has(item.id)),
          ]);
          this.meta.set(page.meta);
          this.isLoadingMore.set(false);
        },
        error: (error) => {
          console.error('Failed to fetch more posts:', error);
          this.isLoadingMore.set(false);
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

  search(): void {
    this.applyFilters({ q: this.searchText().trim() || null });
  }

  selectType(type: ItemTypeFilter): void {
    this.applyFilters({ type: type === 'all' ? null : type });
  }

  selectCategory(value: string): void {
    this.applyFilters({ category_id: value === '' ? null : Number(value) });
  }

  openSave(): void {
    this.saveName.set(this.suggestedName());
    this.saveError.set('');
    this.savedAs.set(null);
    this.isSaveOpen.set(true);
  }

  closeSave(): void {
    this.isSaveOpen.set(false);
    this.saveError.set('');
  }

  submitSave(): void {
    const name = this.saveName().trim();

    if (!name) {
      this.saveError.set('Give the search a name.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set('');

    this.savedSearches.create(name, this.filters()).subscribe({
      next: (response) => {
        this.isSaving.set(false);
        this.isSaveOpen.set(false);
        this.savedAs.set(response.data.name);
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving.set(false);
        this.saveError.set(saveErrorMessage(error));
      },
    });
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

  openTerms() {
    this.router.navigate(['/terms']);
  }

  /** Where to come back to after signing in to save this search. */
  currentUrl(): string {
    return this.router.url;
  }

  private applyFilters(change: Partial<PostFilters>): void {
    this.navigateTo({ ...this.filters(), ...change });
  }

  private navigateTo(filters: PostFilters): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: paramsFromFilters(filters) });
  }

  /** E.g. "keys · Found · Keys", within the 50-character limit. */
  private suggestedName(): string {
    const { q, type, category_id } = this.filters();
    const category = this.categories().find((c) => c.id === category_id)?.name;
    const parts = [
      q ? `“${q}”` : null,
      type === 'lost' ? 'Lost' : type === 'found' ? 'Found' : null,
      category ?? null,
    ];

    return parts
      .filter((part) => part !== null)
      .join(' · ')
      .slice(0, 50);
  }
}

function saveErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 422) {
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    return errors?.['name']?.[0] ?? error.error?.message ?? 'Check the name and try again.';
  }

  if (error.status === 401) {
    return 'Your session has ended. Sign in again to save searches.';
  }

  if (error.status === 429) {
    return 'You are saving searches too quickly. Wait a minute and try again.';
  }

  return 'Could not save the search. Please try again.';
}
