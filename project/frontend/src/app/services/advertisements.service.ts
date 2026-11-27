import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AdminAdvertisement, ApiResponse, SponsoredAdvertisement } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AdvertisementsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/advertisements`;
  private readonly adminBase = `${environment.apiBaseUrl}/admin/advertisements`;

  getForCategory(categoryId: number | null): Observable<SponsoredAdvertisement | null> {
    let params = new HttpParams();
    if (categoryId !== null) params = params.set('category_id', categoryId);

    return this.http
      .get<ApiResponse<SponsoredAdvertisement | null>>(this.base, { params })
      .pipe(map((response) => response.data));
  }

  allForAdmin(): Observable<AdminAdvertisement[]> {
    return this.http
      .get<ApiResponse<AdminAdvertisement[]>>(this.adminBase)
      .pipe(map((response) => response.data));
  }

  create(input: {
    advertiser: string;
    title: string;
    description: string;
    target_url: string;
    category_id: number | null;
  }): Observable<AdminAdvertisement> {
    return this.http
      .post<ApiResponse<AdminAdvertisement>>(this.adminBase, input)
      .pipe(map((response) => response.data));
  }

  approve(id: number): Observable<AdminAdvertisement> {
    return this.http
      .post<ApiResponse<AdminAdvertisement>>(`${this.adminBase}/${id}/approve`, {})
      .pipe(map((response) => response.data));
  }

  reject(id: number): Observable<AdminAdvertisement> {
    return this.http
      .post<ApiResponse<AdminAdvertisement>>(`${this.adminBase}/${id}/reject`, {})
      .pipe(map((response) => response.data));
  }
}
