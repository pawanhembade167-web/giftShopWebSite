import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import IProduct from '../models/IProduct';
import { environment } from '../environments/environment';
import { ApiEnvelope } from './user-api.service';
import { ProductDto, toProduct } from './catalog-api.service';

export interface SearchSuggestionCategory {
  id: number;
  name: string;
}

export interface SearchSuggestionSubcategory {
  name: string;
  categoryId: number;
}

export interface SearchSuggestions {
  products: IProduct[];
  categories: SearchSuggestionCategory[];
  subcategories: SearchSuggestionSubcategory[];
}

export const EMPTY_SUGGESTIONS: SearchSuggestions = { products: [], categories: [], subcategories: [] };

@Injectable({
  providedIn: 'root'
})
export class SearchApi {
  private readonly url = `${environment.apiBaseUrl}/api/search/suggestions`;

  constructor(private http: HttpClient) {}

  suggestions(term: string): Observable<SearchSuggestions> {
    return this.http
      .get<ApiEnvelope<{ products: ProductDto[]; categories: SearchSuggestionCategory[]; subcategories: SearchSuggestionSubcategory[] }>>(
        this.url,
        { params: { q: term } }
      )
      .pipe(
        map((envelope) => ({
          products: envelope.data.products.map(toProduct),
          categories: envelope.data.categories,
          subcategories: envelope.data.subcategories,
        }))
      );
  }
}
