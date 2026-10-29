import { apiFetch, apiFetchPage } from './client';
import type {
  AdminPaymentDetail,
  AdminPaymentFilter,
  AdminPaymentListItem,
  AdminPaymentReviewResult,
  PaginationMeta,
} from './types';

/** Payment submissions by status. Pending ones come oldest first (a review queue). */
export function getAdminPayments(
  status: AdminPaymentFilter,
  page: number,
  limit: number,
): Promise<{ items: AdminPaymentListItem[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ status, page: String(page), limit: String(limit) });
  return apiFetchPage<AdminPaymentListItem>(`/admin/payments?${query.toString()}`);
}

export function getAdminPayment(id: string): Promise<AdminPaymentDetail> {
  return apiFetch<AdminPaymentDetail>(`/admin/payments/${encodeURIComponent(id)}`);
}

export function approveAdminPayment(id: string): Promise<AdminPaymentReviewResult> {
  return apiFetch<AdminPaymentReviewResult>(`/admin/payments/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
  });
}

/** The reason (3 to 500 characters) is shown to the customer. */
export function rejectAdminPayment(id: string, reason: string): Promise<AdminPaymentReviewResult> {
  return apiFetch<AdminPaymentReviewResult>(`/admin/payments/${encodeURIComponent(id)}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
