import { apiFetch, apiFetchPage } from './client';
import type {
  CreateOrderInput,
  OrderDetail,
  OrderListItem,
  OrderView,
  PaginationMeta,
} from './types';

/**
 * Turns the server-side cart into an order. Reuse the SAME idempotencyKey when retrying the
 * same checkout, so a double click or a network retry can never create a second order.
 */
export function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<OrderView> {
  return apiFetch<OrderView>('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

/** One of the signed-in customer's own orders (another customer's order is a 404). */
export function getOrder(id: string): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`);
}

/** The signed-in customer's orders, newest first. Requires a session. */
export function getOrders(
  page: number,
  limit: number,
): Promise<{ items: OrderListItem[]; meta: PaginationMeta }> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetchPage<OrderListItem>(`/orders?${query.toString()}`);
}
/** Cancels one of the signed-in customer's own orders (only while it is unpaid and not under review). */
export function cancelOrder(id: string): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
}