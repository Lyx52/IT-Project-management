import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PostFilters, SavedSearch } from '../models/models';

/** The signed-in user's saved searches. A user has at most 20. */
@Injectable({ providedIn: 'root' })
export class SavedSearchService {
  private readonly http = inject(HttpClient);

  list(): Observable<ApiResponse<SavedSearch[]>> {
    return this.http.get<ApiResponse<SavedSearch[]>>(`${environment.apiBaseUrl}/saved-searches`);
  }

  /** Saves the filters under a name. At least one filter must be set. */
  create(name: string, filters: PostFilters): Observable<ApiResponse<SavedSearch>> {
    return this.http.post<ApiResponse<SavedSearch>>(`${environment.apiBaseUrl}/saved-searches`, {
      name,
      q: filters.q?.trim() || null,
      type: filters.type,
      category_id: filters.category_id,
    });
  }

  /** Only the name can change. */
  rename(id: number, name: string): Observable<ApiResponse<SavedSearch>> {
    return this.http.patch<ApiResponse<SavedSearch>>(
      `${environment.apiBaseUrl}/saved-search/${id}`,
      { name },
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/saved-search/${id}`);
  }
}
