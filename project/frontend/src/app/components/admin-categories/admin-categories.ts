import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { AdminCategory } from '../../models/admin.model';

@Component({
  selector: 'app-admin-categories',
  imports: [],
  templateUrl: './admin-categories.html',
  styleUrl: './admin-categories.scss',
})
export class AdminCategories implements OnInit {
  private readonly admin = inject(AdminService);

  readonly categories = signal<AdminCategory[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly newName = signal('');
  readonly isCreating = signal(false);

  /** The category being renamed, and the name being typed for it. */
  readonly editingId = signal<number | null>(null);
  readonly editingName = signal('');

  readonly isEmpty = computed(() => !this.isLoading() && this.categories().length === 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.admin.categories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load categories. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  isRetired(category: AdminCategory): boolean {
    return category.retired_at !== null;
  }

  /** A category nothing uses can be deleted; one in use must be retired. */
  canDelete(category: AdminCategory): boolean {
    return category.posts_count === 0;
  }

  create(): void {
    const name = this.newName().trim();

    if (name === '') {
      return;
    }

    this.isCreating.set(true);
    this.actionError.set(null);

    this.admin.createCategory(name).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.newName.set('');
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.isCreating.set(false);
        this.actionError.set(this.messageFor(error));
      },
    });
  }

  startRename(category: AdminCategory): void {
    this.actionError.set(null);
    this.editingId.set(category.id);
    this.editingName.set(category.name);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  confirmRename(category: AdminCategory): void {
    const name = this.editingName().trim();

    if (name === '' || name === category.name) {
      this.editingId.set(null);
      return;
    }

    this.editingId.set(null);
    this.run(category.id, this.admin.renameCategory(category.id, name));
  }

  toggleRetired(category: AdminCategory): void {
    this.run(
      category.id,
      this.isRetired(category)
        ? this.admin.restoreCategory(category.id)
        : this.admin.retireCategory(category.id),
    );
  }

  remove(category: AdminCategory): void {
    this.run(category.id, this.admin.deleteCategory(category.id));
  }

  private run(id: number, request: Observable<unknown>): void {
    this.busyId.set(id);
    this.actionError.set(null);

    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.busyId.set(null);
        this.actionError.set(this.messageFor(error));
        this.load();
      },
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    // 422 is a validation failure, such as a duplicate name. 409 is the
    // backend refusing to delete a category that posts still use, and carries
    // its own explanation ("Retire it instead"), so both are worth showing.
    if (error.status === 422 || error.status === 409) {
      const nameError = error.error?.errors?.name?.[0];

      if (typeof nameError === 'string') {
        return nameError;
      }

      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'That change was refused.';
    }

    if (error.status === 403) {
      return 'Your account is not allowed to manage categories.';
    }

    if (error.status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    return 'Something went wrong. Please try again.';
  }
}
