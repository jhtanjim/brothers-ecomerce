import type { ProductSort } from '@/lib/api/types';

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SORT_OPTIONS: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Most popular' },
  { value: 'discount', label: 'Biggest discount' },
];

const DEFAULT_SORT: ProductSort = 'newest';
const MAX_PAGE = 100_000;
const MAX_PRICE = 9_999_999_999.99;

/** Validated storefront query. Everything here is safe to send to the API. */
export interface ProductQuery {
  page: number;
  sort: ProductSort;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function toPrice(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_PRICE ? amount : undefined;
}

function toPage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
}

/** Turns untrusted URL parameters into a validated query. Invalid values are dropped. */
export function parseProductSearchParams(raw: RawSearchParams): ProductQuery {
  const sortValue = first(raw.sort);
  const sort = SORT_OPTIONS.find((option) => option.value === sortValue)?.value ?? DEFAULT_SORT;

  let minPrice = toPrice(first(raw.minPrice));
  let maxPrice = toPrice(first(raw.maxPrice));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    page: toPage(first(raw.page)),
    sort,
    search: first(raw.search)?.slice(0, 100),
    category: first(raw.category)?.slice(0, 120),
    minPrice,
    maxPrice,
    inStock: first(raw.inStock) === 'true' ? true : undefined,
    featured: first(raw.featured) === 'true' ? true : undefined,
  };
}

/** True when the query differs from the plain, unfiltered first page. */
export function isNonDefaultQuery(query: ProductQuery): boolean {
  return (
    query.page > 1 ||
    query.sort !== DEFAULT_SORT ||
    Boolean(query.search || query.category || query.inStock || query.featured) ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined
  );
}

/** True when any filter (not just sort or page) is applied. */
export function hasActiveFilters(query: ProductQuery): boolean {
  return (
    Boolean(query.search || query.category || query.inStock || query.featured) ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined
  );
}

/** Builds a clean /products URL, leaving out default values. */
export function buildProductsHref(query: ProductQuery, overrides: Partial<ProductQuery> = {}): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (next.search) params.set('search', next.search);
  if (next.category) params.set('category', next.category);
  if (next.minPrice !== undefined) params.set('minPrice', String(next.minPrice));
  if (next.maxPrice !== undefined) params.set('maxPrice', String(next.maxPrice));
  if (next.inStock) params.set('inStock', 'true');
  if (next.featured) params.set('featured', 'true');
  if (next.sort !== DEFAULT_SORT) params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  const value = params.toString();
  return value ? `/products?${value}` : '/products';
}