import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import IProduct from '../models/IProduct';
import { environment } from '../environments/environment';
import { ApiEnvelope } from './user-api.service';

export type CatalogSort = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

export interface CatalogRequest {
  q?: string | null;
  categoryId?: number | null;
  subcategory?: string | null;
  productType?: string | null;
  minRating?: number | null;
  brand?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}

export interface ProductDto {
  id: number;
  name: string;
  brand: string | null;
  categoryId: number | null;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string | null;
  description: string | null;
  stock: number;
}

export interface ProductPageResult {
  items: IProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductTypeDto {
  name: string;
  productCount: number;
}

export interface SubcategoryDto {
  name: string;
  productCount: number;
  types: ProductTypeDto[];
}

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  subcategories: SubcategoryDto[];
}

export interface BrandDto {
  name: string;
  productCount: number;
}

export function toProduct(dto: ProductDto): IProduct {
  return {
    id: dto.id,
    Name: dto.name,
    Quantity: dto.stock,
    Price: dto.price,
    Img: dto.imageUrl ?? undefined,
    Categoryid: dto.categoryId ?? undefined,
    Factory: dto.brand ?? undefined,
    Description: dto.description ?? undefined,
    Rating: dto.rating,
    ReviewCount: dto.reviewCount,
  };
}

@Injectable({
  providedIn: 'root'
})
export class CatalogApiService {
  private readonly catalogUrl = `${environment.apiBaseUrl}/api`;

  constructor(private http: HttpClient) {}

  getProducts(request: CatalogRequest = {}): Observable<ProductPageResult> {
    return this.http
      .get<ApiEnvelope<{ items: ProductDto[]; page: number; pageSize: number; total: number; totalPages: number }>>(
        `${this.catalogUrl}/products`,
        { params: this.toParams(request) }
      )
      .pipe(
        map((envelope) => ({
          ...envelope.data,
          items: envelope.data.items.map(toProduct),
        }))
      );
  }

  getProduct(productId: number): Observable<IProduct> {
    return this.http
      .get<ApiEnvelope<{ product: ProductDto }>>(`${this.catalogUrl}/products/${productId}`)
      .pipe(map((envelope) => toProduct(envelope.data.product)));
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.http
      .get<ApiEnvelope<{ categories: CategoryDto[] }>>(`${this.catalogUrl}/categories`)
      .pipe(map((envelope) => envelope.data.categories));
  }

  getBrands(limit = 50): Observable<BrandDto[]> {
    return this.http
      .get<ApiEnvelope<{ brands: BrandDto[] }>>(`${this.catalogUrl}/brands`, { params: { limit } })
      .pipe(map((envelope) => envelope.data.brands));
  }

  private toParams(request: CatalogRequest): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(request)) {
      if (value === null || value === undefined || value === '' || value === false) {
        continue;
      }
      params = params.set(key, String(value));
    }
    return params;
  }
}
