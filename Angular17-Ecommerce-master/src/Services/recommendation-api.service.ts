import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import IProduct from '../models/IProduct';
import { environment } from '../environments/environment';
import { EventTracker } from './event-tracker.service';
import { ApiEnvelope } from './user-api.service';
import { ProductDto, toProduct } from './catalog-api.service';

export interface RecommendedProduct {
  productId: number;
  score: number;
  reason: string;
  product: IProduct;
}

export interface RecommendationResult {
  strategy: string;
  items: RecommendedProduct[];
}

interface RecommendationDto {
  productId: number;
  score: number;
  reason: string;
  product: ProductDto;
}

@Injectable({
  providedIn: 'root'
})
export class RecommendationApi {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/recommendations`;
  private readonly tracker = inject(EventTracker);

  constructor(private http: HttpClient) {}

  home(limit = 8): Observable<RecommendationResult> {
    const anonymousId = this.tracker.anonymousId();
    const params: Record<string, string | number> = { limit };
    if (anonymousId) {
      params['anonymousId'] = anonymousId;
    }
    return this.fetch(`${this.baseUrl}/home`, params);
  }

  forProduct(productId: number, limit = 4): Observable<RecommendationResult> {
    return this.fetch(`${this.baseUrl}/product/${productId}`, { limit });
  }

  similar(productId: number, limit = 4): Observable<RecommendationResult> {
    return this.fetch(`${this.baseUrl}/similar/${productId}`, { limit });
  }

  frequentlyBought(productId: number, limit = 4): Observable<RecommendationResult> {
    return this.fetch(`${this.baseUrl}/frequently-bought/${productId}`, { limit });
  }

  private fetch(url: string, params: Record<string, string | number>): Observable<RecommendationResult> {
    return this.http
      .get<ApiEnvelope<{ strategy: string; recommendations: RecommendationDto[] }>>(url, { params })
      .pipe(
        map((envelope) => ({
          strategy: envelope.data.strategy,
          items: envelope.data.recommendations.map((item) => ({
            productId: item.productId,
            score: item.score,
            reason: item.reason,
            product: toProduct(item.product),
          })),
        }))
      );
  }
}
