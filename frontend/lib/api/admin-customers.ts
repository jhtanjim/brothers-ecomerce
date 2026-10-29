import { apiFetch, apiFetchPage } from './client';
import type { AdminCustomer, AdminCustomerFilters, CustomerStatus, PaginationMeta } from './types';

export function getAdminCustomers(
  filters: AdminCustomerFilters,
  page: number,
  limit: number,
): Promise<{ items: AdminCustomer[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  return apiFetchPage<AdminCustomer>(`/admin/customers?${query.toString()}`);
}

/** Suspending signs the customer out everywhere; the reason is kept in the activity log. */
export function setAdminCustomerStatus(
  id: string,
  status: CustomerStatus,
  reason?: string,
): Promise<AdminCustomer> {
  return apiFetch<AdminCustomer>(`/admin/customers/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
  });
}
