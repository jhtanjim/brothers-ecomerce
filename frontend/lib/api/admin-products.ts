import { apiFetch, apiFetchPage } from './client';
import type {
  AdminProduct,
  AdminProductFilters,
  CreateProductInput,
  CreateVariantInput,
  PaginationMeta,
  ProductStatus,
  UpdateProductInput,
  UpdateVariantInput,
} from './types';

const BASE = '/admin/products';

function productPath(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}`;
}

export function getAdminProducts(
  filters: AdminProductFilters,
  page: number,
  limit: number,
): Promise<{ items: AdminProduct[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) query.set('status', filters.status);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
  if (filters.search) query.set('search', filters.search);
  if (filters.sort) query.set('sort', filters.sort);
  return apiFetchPage<AdminProduct>(`${BASE}?${query.toString()}`);
}

export function getAdminProduct(id: string): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(productPath(id));
}

export function createAdminProduct(input: CreateProductInput): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(BASE, { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminProduct(id: string, input: UpdateProductInput): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(productPath(id), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setAdminProductStatus(id: string, status: ProductStatus): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Only succeeds for products never ordered; otherwise 409 PRODUCT_HAS_ORDERS (archive instead). */
export function deleteAdminProduct(id: string): Promise<null> {
  return apiFetch<null>(productPath(id), { method: 'DELETE' });
}

/** Uploads 1 to 5 JPEG/PNG/WebP files (max 5 MB each, 10 per product). Returns the updated product. */
export function uploadAdminProductImages(id: string, files: File[]): Promise<AdminProduct> {
  const body = new FormData();
  for (const file of files) body.append('images', file);
  return apiFetch<AdminProduct>(`${productPath(id)}/images`, { method: 'POST', body });
}

export function deleteAdminProductImage(id: string, imageId: string): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/images/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
  });
}

export function setAdminProductPrimaryImage(id: string, imageId: string): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(
    `${productPath(id)}/images/${encodeURIComponent(imageId)}/primary`,
    { method: 'PATCH' },
  );
}

/** imageIds must list every image of the product exactly once, in the wanted order. */
export function reorderAdminProductImages(id: string, imageIds: string[]): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/images/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ imageIds }),
  });
}

export function addAdminProductVariant(
  id: string,
  input: CreateVariantInput,
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/variants`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminProductVariant(
  id: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/variants/${encodeURIComponent(variantId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Refused (409 VARIANT_HAS_ORDERS) for an option that has been ordered: set its stock to 0 instead. */
export function deleteAdminProductVariant(id: string, variantId: string): Promise<AdminProduct> {
  return apiFetch<AdminProduct>(`${productPath(id)}/variants/${encodeURIComponent(variantId)}`, {
    method: 'DELETE',
  });
}
