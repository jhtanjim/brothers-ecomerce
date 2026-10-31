import { apiFetch, apiFetchPage } from './client';
import type { PaginationMeta, StockPurchase } from './types';

export interface PurchaseInput {
  supplierName: string;
  note?: string;
  items: { productId: string; variantId?: string; quantity: number; unitCost: number }[];
}

export function getPurchases(
  page: number,
  limit: number,
): Promise<{ items: StockPurchase[]; meta: PaginationMeta }> {
  return apiFetchPage<StockPurchase>(`/admin/purchases?page=${page}&limit=${limit}`);
}

/** The key makes a repeated submit return the first purchase instead of adding the stock twice. */
export function createPurchase(
  input: PurchaseInput,
  idempotencyKey: string,
): Promise<StockPurchase> {
  return apiFetch<StockPurchase>('/admin/purchases', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}
