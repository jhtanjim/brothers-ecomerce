import { apiFetch, apiFetchPage } from './client';
import type {
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderListItem,
  AdminOrderStatusResult,
  OrderStatus,
  PaginationMeta,
} from './types';

/** All orders, newest first. Filters and paging are applied by the database. */
export function getAdminOrders(
  filters: AdminOrderFilters,
  page: number,
  limit: number,
): Promise<{ items: AdminOrderListItem[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.status) query.set('status', filters.status);
  if (filters.paymentStatus) query.set('paymentStatus', filters.paymentStatus);
  if (filters.search) query.set('search', filters.search);
  return apiFetchPage<AdminOrderListItem>(`/admin/orders?${query.toString()}`);
}

export function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`);
}

/** A reason (3 to 500 characters) is required when cancelling. */
export function updateAdminOrderStatus(
  id: string,
  status: OrderStatus,
  reason?: string,
): Promise<AdminOrderStatusResult> {
  return apiFetch<AdminOrderStatusResult>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(reason ? { status, reason } : { status }),
  });
}
