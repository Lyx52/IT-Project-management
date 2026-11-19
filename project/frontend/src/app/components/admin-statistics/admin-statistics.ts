import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { AdminStatistics } from '../../models/admin.model';

/**
 * A Date as the `yyyy-mm-dd` an <input type="date"> expects. Built from the
 * local parts rather than toISOString(), which is UTC and so reports the wrong
 * day for part of every evening east of Greenwich.
 */
const toDateInput = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfThisMonth = (): Date => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), 1);
};

@Component({
  selector: 'app-admin-statistics',
  imports: [TitleCasePipe],
  templateUrl: './admin-statistics.html',
  styleUrl: './admin-statistics.scss',
})
export class AdminStatisticsPanel implements OnInit {
  private readonly admin = inject(AdminService);

  readonly stats = signal<AdminStatistics | null>(null);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  // Prefilled with month-to-date, the same window the API falls back to when a
  // request carries no dates, so the form is never blank while the figures
  // below it already cover a period. Both are re-synced from each response, so
  // this default cannot drift from the server's.
  readonly from = signal(toDateInput(startOfThisMonth()));
  readonly to = signal(toDateInput(new Date()));

  /** Share of posts that reached a resolution, for the headline figure. */
  readonly resolutionRate = computed(() => {
    const stats = this.stats();

    if (!stats || stats.total_posts === 0) {
      return null;
    }

    return Math.round((stats.resolved_count / stats.total_posts) * 100);
  });

  /** by_status as rows, so the template does not iterate an object. */
  readonly statusRows = computed(() => {
    const stats = this.stats();

    return stats
      ? Object.entries(stats.by_status).map(([status, count]) => ({ status, count }))
      : [];
  });

  readonly typeRows = computed(() => {
    const stats = this.stats();

    return stats ? Object.entries(stats.by_type).map(([type, count]) => ({ type, count })) : [];
  });

  /** Column order for the cross-tab, taken from the response so a status
   * added on the backend shows up without a frontend change. */
  readonly statusKeys = computed(() => this.statusRows().map((row) => row.status));

  /**
   * One row per type, with a cell per status and a row total. Built here rather
   * than in the template so the total is not four hardcoded status names.
   */
  readonly matrixRows = computed(() => {
    const stats = this.stats();

    if (!stats) {
      return [];
    }

    const statuses = this.statusKeys();

    return this.typeRows().map(({ type }) => {
      const counts = stats.posts_by_type_and_status?.[type] ?? {};
      const cells = statuses.map((status) => counts[status] ?? 0);

      return {
        type,
        cells,
        total: cells.reduce((sum, count) => sum + count, 0),
      };
    });
  });

  /** Footer row of the cross-tab: the per-status totals across every type. */
  readonly columnTotals = computed(() => {
    const stats = this.stats();

    return stats ? this.statusKeys().map((status) => stats.by_status[status] ?? 0) : [];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.admin
      .statistics({ from: this.from() || undefined, to: this.to() || undefined })
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          // The response reports the window it actually used, so the inputs
          // keep matching the figures even when the request omitted a date.
          this.from.set(stats.from);
          this.to.set(stats.to);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set('Could not load the figures. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  /** Width of a bar as a percentage of the largest value in its group. */
  barWidth(count: number, rows: { count: number }[]): string {
    const largest = Math.max(...rows.map((row) => row.count), 1);

    return `${Math.round((count / largest) * 100)}%`;
  }
}
