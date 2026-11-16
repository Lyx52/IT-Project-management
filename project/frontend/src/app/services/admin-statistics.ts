import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type PostStatusCount = Record<'pending' | 'approved' | 'rejected' | 'resolved', number>;

export interface PlatformStatistics {
  period: { from: string; to: string };
  posts_by_type_and_status: Record<'lost' | 'found', PostStatusCount>;
  resolved_count: number;
  average_resolution_days: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminStatisticsService {
  private readonly http = inject(HttpClient);

  get(from: string, to: string): Observable<{ data: PlatformStatistics }> {
    return this.http.get<{ data: PlatformStatistics }>(`${environment.apiBaseUrl}/admin/statistics`, {
      params: { from, to },
    });
  }
}
