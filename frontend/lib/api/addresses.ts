import { apiFetch } from './client';
import type { AddressInput, AddressView } from './types';

/** The signed-in customer's saved addresses, default first. Requires a session. */
export function getAddresses(): Promise<AddressView[]> {
  return apiFetch<AddressView[]>('/addresses');
}

export function createAddress(input: AddressInput): Promise<AddressView> {
  return apiFetch<AddressView>('/addresses', { method: 'POST', body: JSON.stringify(input) });
}

/** Only the sent fields change. isDefault: true makes this the default (the old default is cleared). */
export function updateAddress(id: string, input: Partial<AddressInput>): Promise<AddressView> {
  return apiFetch<AddressView>(`/addresses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Deleting the default address makes the newest remaining address the default. */
export function deleteAddress(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
