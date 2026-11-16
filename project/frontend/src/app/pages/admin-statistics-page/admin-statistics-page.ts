import { TitleCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Header } from '../../components/header/header';
import { AdminStatisticsService, PlatformStatistics } from '../../services/admin-statistics';

const dateInputValue = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

@Component({
  selector: 'app-admin-statistics-page',
  standalone: true,
  imports: [Header, TitleCasePipe],
  templateUrl: './admin-statistics-page.html',
})
export class AdminStatisticsPage {
  private readonly statisticsService = inject(AdminStatisticsService);

  readonly statuses = ['pending', 'approved', 'rejected', 'resolved'] as const;
  readonly types = ['lost', 'found'] as const;
  readonly from = signal(dateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  readonly to = signal(dateInputValue(new Date()));
  readonly statistics = signal<PlatformStatistics | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = computed(() => {
    const counts = this.statistics()?.posts_by_type_and_status;
    return this.types.map((type) => ({ type, counts: counts?.[type] }));
  });

  constructor() {
    this.load();
  }

  onDateChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (field === 'from' ? this.from : this.to).set(value);
  }

  load(): void {
    if (!this.from() || !this.to() || this.from() > this.to()) {
      this.error.set('Choose a valid date range.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.statistics.set(null);

    this.statisticsService.get(this.from(), this.to()).subscribe({
      next: (response) => {
        this.statistics.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load statistics. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
