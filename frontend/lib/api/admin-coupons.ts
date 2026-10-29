import { apiFetch, apiFetchPage } from './client';
import type {
  AdminCoupon,
  AdminCouponFilters,
  CouponStatus,
  CreateCouponInput,
  PaginationMeta,
  UpdateCouponInput,
} from './types';

export function getAdminCoupons(
  filters: AdminCouponFilters,
  page: number,
  limit: number,
): Promise<{ items: AdminCoupon[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  return apiFetchPage<AdminCoupon>(`/admin/coupons?${query.toString()}`);
}

export function getAdminCoupon(id: string): Promise<AdminCoupon> {
  return apiFetch<AdminCoupon>(`/admin/coupons/${encodeURIComponent(id)}`);
}

export function createAdminCoupon(input: CreateCouponInput): Promise<AdminCoupon> {
  return apiFetch<AdminCoupon>('/admin/coupons', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminCoupon(id: string, input: UpdateCouponInput): Promise<AdminCoupon> {
  return apiFetch<AdminCoupon>(`/admin/coupons/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setAdminCouponStatus(id: string, status: CouponStatus): Promise<AdminCoupon> {
  return apiFetch<AdminCoupon>(`/admin/coupons/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteAdminCoupon(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/admin/coupons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
