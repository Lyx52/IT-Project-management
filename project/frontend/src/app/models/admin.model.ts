import { Item } from './models';

/** A user as returned by GET /api/v1/admin/users (AdminUserResource). */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  banned_at: string | null;
  email_verified_at: string | null;
  posts_count: number;
  created_at: string;
}

/** One open report in the moderation queue. */
export interface ModerationReport {
  id: number;
  reason: string;
  status: 'open' | 'closed';
  created_at: string;
  /** Null when the reporter deleted their account. */
  reporter: { id: number; username: string } | null;
  /** Null when the reported post is already gone. */
  post: Item | null;
}

/** Body of GET /api/v1/admin/moderation/queue, under `data`. */
export interface ModerationQueue {
  pending_posts: Item[];
  open_reports: ModerationReport[];
}

/** Laravel's paginated collection envelope. */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type UserStatusFilter = 'all' | 'active' | 'banned';

/** A category as returned by GET /api/v1/admin/categories. */
export interface AdminCategory {
  id: number;
  name: string;
  /** Non-null means hidden from the pickers; existing posts keep using it. */
  retired_at: string | null;
  posts_count: number;
}

/** What a moderator did about a report, which is what its reporter is told. */
export type ReportOutcome = 'action_taken' | 'dismissed';

/** Aggregates from GET /api/v1/admin/statistics. Contains no personal data. */
export interface AdminStatistics {
  from: string;
  to: string;
  total_posts: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  /** Cross-tab of type against status, e.g. posts_by_type_and_status.lost.pending. */
  posts_by_type_and_status: Record<string, Record<string, number>>;
  resolved_count: number;
  /** Null when nothing was resolved in the window. */
  average_days_to_resolution: number | null;
  open_reports: number;
  banned_users: number;
}
