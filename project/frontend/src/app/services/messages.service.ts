
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Message, Paginated } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MessagesService {
  private readonly http = inject(HttpClient);

  private readonly headers = new HttpHeaders({
    Accept: 'application/json',
  });

  /**
   * Get messages for a post.
   * Authors must provide userId to retrieve a specific visitor conversation.
   */
  getMessages(postId: number, userId?: number, page = 1): Observable<Paginated<Message>> {
    let params = new HttpParams().set('page', page);

    if (userId !== undefined) {
      params = params.set('user_id', userId);
    }

    return this.http.get<Paginated<Message>>(
      `${environment.apiBaseUrl}/post/${postId}/messages`,
      {
        headers: this.headers,
        params,
      },
    );
  }

  /**
   * Send a message about a post.
   * Authors must provide userId to reply to a specific visitor.
   */
  sendMessage(
    postId: number,
    body: string,
    userId?: number,
  ): Observable<ApiResponse<Message>> {
    const payload: { body: string; user_id?: number } = { body };

    if (userId !== undefined) {
      payload.user_id = userId;
    }

    return this.http.post<ApiResponse<Message>>(
      `${environment.apiBaseUrl}/post/${postId}/messages`,
      payload,
      {
        headers: this.headers,
      },
    );
  }
}
