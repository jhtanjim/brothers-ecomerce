import { apiFetch } from './client';
import type { OrderReturn, PaymentMethod } from './types';

export interface OrderReturnInput {
  items: { orderItemId: string; quantity: number }[];
  reason: string;
  restock: boolean;
  /** Leave out for an exchange: the value becomes credit for a new sale. */
  refundMethod?: PaymentMethod;
}

/** The key makes a repeated submit return the first result instead of processing it twice. */
export function createOrderReturn(
  orderId: string,
  input: OrderReturnInput,
  idempotencyKey: string,
): Promise<OrderReturn> {
  return apiFetch<OrderReturn>(`/admin/orders/${encodeURIComponent(orderId)}/returns`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function getOrderReturn(id: string): Promise<OrderReturn> {
  return apiFetch<OrderReturn>(`/admin/returns/${encodeURIComponent(id)}`);
}
