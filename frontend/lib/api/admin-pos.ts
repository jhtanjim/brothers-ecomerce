import { apiFetch } from './client';
import type { AdminOrderDetail, PaymentMethod } from './types';

export interface PosSaleInput {
  items: { productId: string; variantId?: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  /** Cash only. */
  cashReceived?: number;
  /** bKash and Nagad only. */
  transactionId?: string;
  discount?: number;
  /** A return whose exchange credit pays towards this sale. */
  exchangeReturnId?: string;
  customerName?: string;
  customerPhone?: string;
}

/** The key makes a repeated submit return the first sale instead of selling twice. */
export function createPosSale(
  input: PosSaleInput,
  idempotencyKey: string,
): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>('/admin/pos/sales', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

/** Cancels a counter sale and puts its items back into stock. */
export function voidPosSale(id: string, reason: string): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>(`/admin/pos/sales/${encodeURIComponent(id)}/void`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
