import { apiFetch, apiFetchPage } from './client';
import type {
  AdminCategory,
  AdminCategoryFilters,
  CategoryStatus,
  CreateCategoryInput,
  PaginationMeta,
  UpdateCategoryInput,
} from './types';

export function getAdminCategories(
  filters: AdminCategoryFilters,
  page: number,
  limit: number,
): Promise<{ items: AdminCategory[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.sort) query.set('sort', filters.sort);
  return apiFetchPage<AdminCategory>(`/admin/categories?${query.toString()}`);
}

export function getAdminCategory(id: string): Promise<AdminCategory> {
  return apiFetch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`);
}

export function createAdminCategory(input: CreateCategoryInput): Promise<AdminCategory> {
  return apiFetch<AdminCategory>('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<AdminCategory> {
  return apiFetch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setAdminCategoryStatus(id: string, status: CategoryStatus): Promise<AdminCategory> {
  return apiFetch<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Only succeeds when no product (any status) uses the category; otherwise 409 CATEGORY_HAS_PRODUCTS. */
export function deleteAdminCategory(id: string): Promise<null> {
  return apiFetch<null>(`/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
