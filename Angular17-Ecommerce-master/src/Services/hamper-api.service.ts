import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiEnvelope } from './user-api.service';

export interface HamperLine {
  productId: number;
  quantity: number;
}

export interface HamperRequest {
  title: string;
  occasion: string | null;
  recipientName: string;
  message: string | null;
  budget: number | null;
  deliveryDate: string | null;
  giftWrap: boolean;
  addressId: number;
  items: HamperLine[];
}

export interface HamperSummary {
  id: number;
  title: string;
  estimatedTotal: number;
  status: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class HamperApi {
  private readonly url = `${environment.apiBaseUrl}/api/hampers`;

  constructor(private http: HttpClient) {}

  create(request: HamperRequest): Observable<HamperSummary> {
    return this.http.post<ApiEnvelope<{ hamper: HamperSummary }>>(this.url, request).pipe(map((e) => e.data.hamper));
  }

  mine(): Observable<HamperSummary[]> {
    return this.http.get<ApiEnvelope<{ hampers: HamperSummary[] }>>(this.url).pipe(map((e) => e.data.hampers));
  }
}
