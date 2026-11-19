import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AdminCategory,
  AdminStatistics,
  AdminUser,
  ModerationQueue,
  Paginated,
  UserStatusFilter,
} from '../models/admin.model';
import { ApiResponse, Item } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  /** Pending posts awaiting approval, plus every open report. */
  queue(): Observable<ModerationQueue> {
    return this.http
      .get<ApiResponse<ModerationQueue>>(`${this.base}/moderation/queue`)
      .pipe(map((response) => response.data));
  }

  /** Publishes a pending post. 422 if it is not pending. */
  approvePost(postId: number): Observable<Item> {
    return this.http
      .post<ApiResponse<Item>>(`${this.base}/posts/${postId}/approve`, {})
      .pipe(map((response) => response.data));
  }

  /** Refuses a pending post, so it is never published. 422 if it is not pending. */
  rejectPost(postId: number, reason?: string): Observable<Item> {
    return this.http
      .post<ApiResponse<Item>>(`${this.base}/posts/${postId}/reject`, reason ? { reason } : {})
      .pipe(map((response) => response.data));
  }

  /**
   * Removes an already published post from the feed. Distinct from reject,
   * which only applies to posts that were never published, so this is the
   * action for a reported post. 422 if the post is still pending.
   */
  takedownPost(postId: number, reason?: string): Observable<Item> {
    return this.http
      .post<ApiResponse<Item>>(`${this.base}/posts/${postId}/takedown`, reason ? { reason } : {})
      .pipe(map((response) => response.data));
  }

  /** Marks a report handled so it leaves the queue. 422 if already closed. */
  closeReport(reportId: number): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/reports/${reportId}/close`, {})
      .pipe(map(() => undefined));
  }

  users(
    options: { search?: string; status?: UserStatusFilter } = {},
  ): Observable<Paginated<AdminUser>> {
    let params = new HttpParams();

    if (options.search) {
      params = params.set('search', options.search);
    }

    if (options.status && options.status !== 'all') {
      params = params.set('status', options.status);
    }

    return this.http.get<Paginated<AdminUser>>(`${this.base}/users`, { params });
  }

  /** Bans a user and revokes their tokens server-side. 422 for an admin. */
  banUser(userId: number): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/users/${userId}/ban`, {})
      .pipe(map(() => undefined));
  }

  // --- categories (PB-37) ---------------------------------------------

  /** Every category, retired ones included. */
  categories(): Observable<AdminCategory[]> {
    return this.http
      .get<ApiResponse<AdminCategory[]>>(`${this.base}/categories`)
      .pipe(map((response) => response.data));
  }

  createCategory(name: string): Observable<AdminCategory> {
    return this.http
      .post<ApiResponse<AdminCategory>>(`${this.base}/categories`, { name })
      .pipe(map((response) => response.data));
  }

  renameCategory(id: number, name: string): Observable<AdminCategory> {
    return this.http
      .patch<ApiResponse<AdminCategory>>(`${this.base}/categories/${id}`, { name })
      .pipe(map((response) => response.data));
  }

  /** Hides it from the pickers. Use for a category posts already reference. */
  retireCategory(id: number): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/categories/${id}/retire`, {})
      .pipe(map(() => undefined));
  }

  restoreCategory(id: number): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/categories/${id}/restore`, {})
      .pipe(map(() => undefined));
  }

  /** Only possible when nothing uses it; otherwise the backend answers 422. */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<unknown>(`${this.base}/categories/${id}`).pipe(map(() => undefined));
  }

  // --- statistics (PB-50) ----------------------------------------------

  statistics(range: { from?: string; to?: string } = {}): Observable<AdminStatistics> {
    let params = new HttpParams();

    if (range.from) {
      params = params.set('from', range.from);
    }

    if (range.to) {
      params = params.set('to', range.to);
    }

    return this.http
      .get<ApiResponse<AdminStatistics>>(`${this.base}/statistics`, { params })
      .pipe(map((response) => response.data));
  }

  unbanUser(userId: number): Observable<void> {
    return this.http
      .post<unknown>(`${this.base}/users/${userId}/unban`, {})
      .pipe(map(() => undefined));
  }
}
