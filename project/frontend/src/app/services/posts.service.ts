import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Category, Item, Paginated, Post, PostFilters } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    Accept: 'application/json',
  });

  getPosts(): Observable<ApiResponse<Post[]>> {
    return this.http.get<ApiResponse<Post[]>>(`${environment.apiBaseUrl}/posts`, {
      headers: this.headers,
    });
  }

  /**
   * The public feed narrowed down by the filters that are set. These are the
   * same filters a saved search stores, so its notifications match exactly
   * what this returns. Newest first, 20 per page.
   */
  searchPosts(filters: PostFilters, page = 1): Observable<Paginated<Item>> {
    let params = new HttpParams().set('page', page);

    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.type) {
      params = params.set('type', filters.type);
    }
    if (filters.category_id !== null) {
      params = params.set('category_id', filters.category_id);
    }
    if (filters.date_from) {
      params = params.set('date_from', filters.date_from);
    }
    if (filters.date_to) {
      params = params.set('date_to', filters.date_to);
    }

    return this.http.get<Paginated<Item>>(`${environment.apiBaseUrl}/posts/query`, {
      headers: this.headers,
      params,
    });
  }

  /** The signed-in user's own posts in every status, newest first. */
  getMyPosts(page = 1): Observable<Paginated<Item>> {
    return this.http.get<Paginated<Item>>(`${environment.apiBaseUrl}/user/posts`, {
      headers: this.headers,
      params: { page },
    });
  }

  /** Posts that might be the other half of one of the user's own posts. */
  getMatches(id: number): Observable<ApiResponse<Item[]>> {
    return this.http.get<ApiResponse<Item[]>>(`${environment.apiBaseUrl}/post/${id}/matches`, {
      headers: this.headers,
    });
  }

  createPost(formData: FormData): Observable<ApiResponse<Post>> {
    return this.http.post<ApiResponse<Post>>(`${environment.apiBaseUrl}/posts`, formData, {
      headers: this.headers,
    });
  }

  /** Partial update (author only). Sent as POST, as the API expects. */
  updatePost(id: number, formData: FormData): Observable<ApiResponse<Post>> {
    return this.http.post<ApiResponse<Post>>(`${environment.apiBaseUrl}/post/${id}`, formData, {
      headers: this.headers,
    });
  }

  reportUser(
    userId: number,
    postId: number,
    reason: string,
  ): Observable<{ message: string; data: { id: number; reported_user_id: number } }> {
    return this.http.post<{ message: string; data: { id: number; reported_user_id: number } }>(
      `${environment.apiBaseUrl}/user/${userId}/report`,
      { post_id: postId, reason },
      { headers: this.headers },
    );
  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/post/${id}`, {
      headers: this.headers,
    });
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/post/${id}`, {
      headers: this.headers,
    });
  }

  getPostById(id: number): Observable<ApiResponse<Item>> {
    return this.http.get<ApiResponse<Item>>(`${environment.apiBaseUrl}/post/${id}`, {
      headers: this.headers,
    });
  }

  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${environment.apiBaseUrl}/category/query`, {
      headers: this.headers,
    });
  }
  // Inside PostService:
  closePost(id: number): Observable<void> {
    return this.http.post<void>(
      `${environment.apiBaseUrl}/post/${id}/resolve`,
      {},
      { headers: this.headers },
    );
  }
}
