import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface ReporterSummary {
  id: number;
  username: string;
}

interface PostSummary {
  id: number;
  title: string;
  type?: 'lost' | 'found';
  status?: string;
}

export interface PostReportQueueItem {
  id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter: ReporterSummary | null;
  post: PostSummary | null;
}

export interface UserReportQueueItem {
  id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter: ReporterSummary | null;
  reported_user: (ReporterSummary & { banned_at: string | null }) | null;
  post: Pick<PostSummary, 'id' | 'title'> | null;
}

export interface ModerationQueue {
  open_reports: PostReportQueueItem[];
  open_user_reports: UserReportQueueItem[];
}

@Injectable({ providedIn: 'root' })
export class AdminModerationService {
  private readonly http = inject(HttpClient);

  getQueue(): Observable<{ data: ModerationQueue }> {
    return this.http.get<{ data: ModerationQueue }>(
      `${environment.apiBaseUrl}/admin/moderation/queue`,
    );
  }

  banUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiBaseUrl}/admin/users/${userId}/ban`,
      {},
    );
  }
}
