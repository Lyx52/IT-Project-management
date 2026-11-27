import { Component, inject, signal } from '@angular/core';
import { AdminAdvertisement, Category } from '../../models/models';
import { AdvertisementsService } from '../../services/advertisements.service';
import { PostService } from '../../services/posts.service';

type AdvertisementDraft = {
  advertiser: string;
  title: string;
  description: string;
  target_url: string;
  category_id: string;
};

const EMPTY_DRAFT: AdvertisementDraft = {
  advertiser: '',
  title: '',
  description: '',
  target_url: '',
  category_id: '',
};

@Component({
  selector: 'app-admin-advertisements',
  standalone: true,
  templateUrl: './admin-advertisements.html',
  styleUrl: './admin-advertisements.scss',
})
export class AdminAdvertisements {
  private readonly ads = inject(AdvertisementsService);
  private readonly posts = inject(PostService);

  readonly advertisements = signal<AdminAdvertisement[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly draft = signal<AdvertisementDraft>({ ...EMPTY_DRAFT });
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly busyId = signal<number | null>(null);
  readonly error = signal('');
  readonly notice = signal('');

  constructor() {
    this.load();
    this.posts.getCategories().subscribe({
      next: (response) => this.categories.set(response.data),
      error: () => this.error.set('Could not load categories.'),
    });
  }

  load(): void {
    this.isLoading.set(true);
    this.ads.allForAdmin().subscribe({
      next: (advertisements) => {
        this.advertisements.set(advertisements);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load advertisements. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  updateDraft<K extends keyof AdvertisementDraft>(key: K, value: AdvertisementDraft[K]): void {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  submit(): void {
    if (this.isSaving()) return;

    this.error.set('');
    this.notice.set('');
    this.isSaving.set(true);
    const draft = this.draft();

    this.ads
      .create({
        advertiser: draft.advertiser.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        target_url: draft.target_url.trim(),
        category_id: draft.category_id ? Number(draft.category_id) : null,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.draft.set({ ...EMPTY_DRAFT });
          this.notice.set('Advertisement submitted for approval.');
          this.load();
        },
        error: (error) => {
          this.isSaving.set(false);
          this.error.set(error.error?.message ?? 'Could not save this advertisement.');
        },
      });
  }

  moderate(id: number, action: 'approve' | 'reject'): void {
    if (this.busyId() !== null) return;

    this.error.set('');
    this.notice.set('');
    this.busyId.set(id);
    const request = action === 'approve' ? this.ads.approve(id) : this.ads.reject(id);

    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(
          action === 'approve' ? 'Advertisement approved.' : 'Advertisement rejected.',
        );
        this.load();
      },
      error: (error) => {
        this.busyId.set(null);
        this.error.set(error.error?.message ?? 'Could not update this advertisement.');
      },
    });
  }
}
