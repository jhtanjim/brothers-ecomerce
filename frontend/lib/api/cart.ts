import { apiFetch } from './client';
import type { CartView } from './types';

/** Requires a signed-in user; a signed-out call rejects with an ApiError (status 401). */
export function getCart(): Promise<CartView> {
  return apiFetch<CartView>('/cart');
}

export function addCartItem(productId: string, quantity: number): Promise<CartView> {
  return apiFetch<CartView>('/cart/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export function updateCartItem(itemId: string, quantity: number): Promise<CartView> {
  return apiFetch<CartView>(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(itemId: string): Promise<CartView> {
  return apiFetch<CartView>(`/cart/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
}

export function clearCart(): Promise<CartView> {
  return apiFetch<CartView>('/cart', { method: 'DELETE' });
}
