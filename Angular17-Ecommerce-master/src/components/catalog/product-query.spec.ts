import { DEFAULT_PRODUCT_FILTER, pageWindow, parseCatalogParams } from './product-query';

describe('parseCatalogParams', () => {
  it('reads every catalog filter and sort from the url params', () => {
    const result = parseCatalogParams({
      q: 'laptop', category: '1', subcategory: 'Nail Polish', type: 'Gel', rating: '4', brand: 'HP', min: '100', max: '500', stock: '1', sort: 'price-asc', page: '2',
    });

    expect(result.filter).toEqual({
      search: 'laptop', categoryId: 1, subcategory: 'Nail Polish', productType: 'Gel', minRating: 4, brand: 'HP', minPrice: 100, maxPrice: 500, inStockOnly: true,
    });
    expect(result.sort).toBe('price-asc');
    expect(result.page).toBe(2);
  });

  it('falls back to defaults for missing params', () => {
    const result = parseCatalogParams({});

    expect(result.filter).toEqual(DEFAULT_PRODUCT_FILTER);
    expect(result.sort).toBe('relevance');
    expect(result.page).toBe(1);
  });

  it('ignores malformed numbers and unknown sort values', () => {
    const result = parseCatalogParams({ category: 'abc', min: '-5', sort: 'bogus', page: 'x' });

    expect(result.filter.categoryId).toBeNull();
    expect(result.filter.minPrice).toBeNull();
    expect(result.sort).toBe('relevance');
    expect(result.page).toBe(1);
  });

  it('ignores ratings that are not one of the offered steps', () => {
    expect(parseCatalogParams({ rating: '3.7' }).filter.minRating).toBeNull();
    expect(parseCatalogParams({ rating: '4.5' }).filter.minRating).toBe(4.5);
  });

  it('accepts the rating sort', () => {
    expect(parseCatalogParams({ sort: 'rating' }).sort).toBe('rating');
  });
});

describe('pageWindow', () => {
  it('lists every page when there are only a few', () => {
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('shows the first page, a window around the current page, and the last page with gaps', () => {
    expect(pageWindow(10, 42)).toEqual([1, 'gap', 9, 10, 11, 'gap', 42]);
  });

  it('starts at the first page without a leading gap', () => {
    expect(pageWindow(1, 42)).toEqual([1, 2, 'gap', 42]);
  });

  it('ends at the last page without a trailing gap', () => {
    expect(pageWindow(42, 42)).toEqual([1, 'gap', 41, 42]);
  });

  it('returns a single page when the catalog has only one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
