import { apiFetch } from './client';
import type { AddressInput, AddressView } from './types';

/** The signed-in customer's saved addresses, default first. Requires a session. */
export function getAddresses(): Promise<AddressView[]> {
  return apiFetch<AddressView[]>('/addresses');
}

export function createAddress(input: AddressInput): Promise<AddressView> {
  return apiFetch<AddressView>('/addresses', { method: 'POST', body: JSON.stringify(input) });
}
