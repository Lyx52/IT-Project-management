import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Header } from '../../components/header/header';
import { AdminPendingPosts } from '../../components/admin-pending-posts/admin-pending-posts';
import { AdminReports } from '../../components/admin-reports/admin-reports';
import { AdminUsers } from '../../components/admin-users/admin-users';
import { AdminCategories } from '../../components/admin-categories/admin-categories';
import { AdminStatisticsPanel } from '../../components/admin-statistics/admin-statistics';
import { AdminAdvertisements } from '../../components/admin-advertisements/admin-advertisements';
import { AdminService } from '../../services/admin.service';
import { ModerationQueue } from '../../models/admin.model';

type AdminTab = 'pending' | 'reports' | 'users' | 'categories' | 'advertisements' | 'statistics';

@Component({
  selector: 'app-admin-page',
  imports: [
    Header,
    AdminPendingPosts,
    AdminReports,
    AdminUsers,
    AdminCategories,
    AdminAdvertisements,
    AdminStatisticsPanel,
  ],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPageComponent implements OnInit {
  private readonly admin = inject(AdminService);

  readonly tab = signal<AdminTab>('pending');

  /** Tabs that fetch their own data, so the queue spinner does not hide them. */
  private readonly selfLoading: AdminTab[] = [
    'users',
    'categories',
    'advertisements',
    'statistics',
  ];

  readonly usesQueue = computed(() => !this.selfLoading.includes(this.tab()));

  readonly queue = signal<ModerationQueue>({ pending_posts: [], open_reports: [] });
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly pendingPosts = computed(() => this.queue().pending_posts);
  readonly openReports = computed(() => this.queue().open_reports);

  /** Shown on the tabs so the counts are visible without switching. */
  readonly pendingCount = computed(() => this.pendingPosts().length);
  readonly reportCount = computed(() => this.openReports().length);

  ngOnInit(): void {
    this.loadQueue();
  }

  selectTab(tab: AdminTab): void {
    this.tab.set(tab);
  }

  /**
   * Both moderation tabs read from one request, so an action in either tab
   * reloads both and the counts cannot drift apart.
   */
  loadQueue(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.admin.queue().subscribe({
      next: (queue) => {
        this.queue.set(queue);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load the moderation queue. Please try again.');
        this.isLoading.set(false);
      },
    });
  }
}
