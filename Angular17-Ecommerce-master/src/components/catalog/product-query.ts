export type ProductSort = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

export interface ProductFilter {
  search: string;
  categoryId: number | null;
  subcategory: string | null;
  productType: string | null;
  minRating: number | null;
  brand: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
}

export interface CatalogQuery {
  filter: ProductFilter;
  sort: ProductSort;
  page: number;
}

export const DEFAULT_PRODUCT_FILTER: ProductFilter = {
  search: '',
  categoryId: null,
  subcategory: null,
  productType: null,
  minRating: null,
  brand: null,
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
};

const SORT_OPTIONS: readonly ProductSort[] = ['relevance', 'price-asc', 'price-desc', 'newest', 'rating'];

function parseNonNegativeNumber(raw: string | null | undefined): number | null {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value >= 0 ? value : null;
}

const RATING_STEPS = [1, 2, 3, 4, 4.5];

function parseRating(raw: string | null | undefined): number | null {
  const value = Number(raw);
  return RATING_STEPS.includes(value) ? value : null;
}

function parsePositiveInteger(raw: string | null | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

export function parseCatalogParams(params: Record<string, string | null | undefined>): CatalogQuery {
  const sort = SORT_OPTIONS.find((option) => option === params['sort']) ?? 'relevance';

  return {
    filter: {
      search: params['q'] ?? '',
      categoryId: parseNonNegativeNumber(params['category']),
      subcategory: params['subcategory'] || null,
      productType: params['type'] || null,
      minRating: parseRating(params['rating']),
      brand: params['brand'] || null,
      minPrice: parseNonNegativeNumber(params['min']),
      maxPrice: parseNonNegativeNumber(params['max']),
      inStockOnly: params['stock'] === '1',
    },
    sort,
    page: parsePositiveInteger(params['page'], 1),
  };
}

export type PageToken = number | 'gap';

/** Page numbers to show: the first and last page, a neighbourhood around the current one, and gaps between. */
export function pageWindow(current: number, total: number, radius = 1): PageToken[] {
  const pages = new Set<number>([1, total]);
  for (let page = current - radius; page <= current + radius; page++) {
    if (page >= 1 && page <= total) {
      pages.add(page);
    }
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const tokens: PageToken[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      tokens.push('gap');
    }
    tokens.push(page);
  });
  return tokens;
}
