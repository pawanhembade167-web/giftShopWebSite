import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { CatalogApiService, CategoryDto } from './catalog-api.service';

/**
 * Holds the product categories that the API reports, so navigation, footer and filters
 * all read the same list. Failure leaves the list empty instead of breaking the page.
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryStore {
  private readonly catalogApi = inject(CatalogApiService);

  readonly categories = signal<CategoryDto[]>([]);

  load(): Observable<CategoryDto[]> {
    return this.catalogApi.getCategories().pipe(
      tap((categories) => this.categories.set(categories)),
      catchError(() => of([] as CategoryDto[]))
    );
  }
}
