import { ApiError, apiFetch, apiFetchPage } from './client';
import type { PaginationMeta, ProductDetail, ProductListItem, ProductSort } from './types';

/** Catalog data changes rarely; a short revalidate window keeps pages fast but fresh. */
const CATALOG_REVALIDATE_SECONDS = 60;

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Category slug. */
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Only `true` is sent; omit to include out-of-stock products. */
  inStock?: boolean;
  featured?: boolean;
  sort?: ProductSort;
}

function toQueryString(params: ProductListParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.minPrice !== undefined) query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) query.set('maxPrice', String(params.maxPrice));
  if (params.inStock === true) query.set('inStock', 'true');
  if (params.featured !== undefined) query.set('featured', String(params.featured));
  if (params.sort) query.set('sort', params.sort);
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function getProducts(
  params: ProductListParams = {},
): Promise<{ items: ProductListItem[]; meta: PaginationMeta }> {
  return apiFetchPage<ProductListItem>(`/products${toQueryString(params)}`, {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS },
  });
}

/**
 * Returns null when the product does not exist or is hidden (the API answers 404 for both).
 * Not cached: Next keeps a stale copy when a refresh gets a 404, so a hidden product would stay visible.
 */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    return await apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
