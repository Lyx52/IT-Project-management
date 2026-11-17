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
}