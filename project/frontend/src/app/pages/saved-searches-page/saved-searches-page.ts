import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { SavedSearch } from '../../models/models';
import { SavedSearchService } from '../../services/saved-searches.service';
import { Messenger } from '../../components/messenger/messenger';

/**
 * The user's saved searches. Each one notifies the user about newly approved
 * posts that match it; here they can be opened, renamed and deleted.
 */
@Component({
  selector: 'app-saved-searches-page',
  imports: [Header, Footer, RouterLink, Messenger],
  templateUrl: './saved-searches-page.html',
  styleUrl: './saved-searches-page.scss',
})
export class SavedSearchesPage {
  private readonly savedSearches = inject(SavedSearchService);
  private readonly router = inject(Router);

  readonly searches = signal<SavedSearch[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal('');

  /** The search being renamed, and the name being typed. */
  readonly editingId = signal<number | null>(null);
  readonly editName = signal('');
  /** The search whose "Delete" was clicked once and waits for confirmation. */
  readonly confirmingDeleteId = signal<number | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly rowError = signal<{ id: number; message: string } | null>(null);

  constructor() {
    this.load();
  }

  readonly unreadMessagesCount = signal(0);

  isMessengerOpen = false;

  toggleMessenger(): void {
    this.isMessengerOpen = !this.isMessengerOpen;
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set('');

    this.savedSearches.list().subscribe({
      next: (response) => {
        this.searches.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load your saved searches. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  /** E.g. `“keys” · Found items · Keys`. */
  summary(search: SavedSearch): string {
    return [
      search.q ? `“${search.q}”` : null,
      search.type ? `${search.type === 'lost' ? 'Lost' : 'Found'} items` : null,
      search.category?.name ?? null,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }

  /** The Items page link that runs this search again. */
  queryParams(search: SavedSearch): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (search.q) params['q'] = search.q;
    if (search.type) params['type'] = search.type;
    if (search.category) params['category_id'] = search.category.id;

    return params;
  }

  startRename(search: SavedSearch): void {
    this.confirmingDeleteId.set(null);
    this.rowError.set(null);
    this.editName.set(search.name);
    this.editingId.set(search.id);
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.rowError.set(null);
  }

  saveRename(search: SavedSearch): void {
    const name = this.editName().trim();

    if (!name) {
      this.rowError.set({ id: search.id, message: 'The name cannot be empty.' });
      return;
    }

    if (name === search.name) {
      this.cancelRename();
      return;
    }

    this.busyId.set(search.id);
    this.rowError.set(null);

    this.savedSearches.rename(search.id, name).subscribe({
      next: (response) => {
        this.searches.update((list) => list.map((s) => (s.id === search.id ? response.data : s)));
        this.editingId.set(null);
        this.busyId.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);
        this.rowError.set({
          id: search.id,
          message:
            error.status === 422
              ? (error.error?.errors?.name?.[0] ?? 'Choose another name.')
              : 'Could not rename the search. Please try again.',
        });
      },
    });
  }

  askDelete(search: SavedSearch): void {
    this.editingId.set(null);
    this.rowError.set(null);
    this.confirmingDeleteId.set(search.id);
  }

  delete(search: SavedSearch): void {
    this.busyId.set(search.id);
    this.rowError.set(null);

    this.savedSearches.delete(search.id).subscribe({
      next: () => {
        this.searches.update((list) => list.filter((s) => s.id !== search.id));
        this.confirmingDeleteId.set(null);
        this.busyId.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);

        // Already gone, e.g. deleted in another tab
        if (error.status === 404) {
          this.searches.update((list) => list.filter((s) => s.id !== search.id));
          return;
        }

        this.rowError.set({
          id: search.id,
          message: 'Could not delete the search. Please try again.',
        });
      },
    });
  }

  openTerms(): void {
    this.router.navigate(['/terms']);
  }
}
