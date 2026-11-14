
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Post } from '../models/models';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    Accept: 'application/json',
  });

  getPosts(): Observable<ApiResponse<Post[]>> {
    return this.http.get<ApiResponse<Post[]>>(
      `${environment.apiBaseUrl}/posts`,
      { headers: this.headers },
    );
  }

  createPost(formData: FormData): Observable<ApiResponse<Post>> {
    return this.http.post<ApiResponse<Post>>(
      `${environment.apiBaseUrl}/posts`,
      formData,
      { headers: this.headers },
    );
  }
}
