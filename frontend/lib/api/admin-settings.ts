import { apiFetch } from './client';
import type { AdminSettings, UpdateSettingsInput } from './types';

export function getAdminSettings(): Promise<AdminSettings> {
  return apiFetch<AdminSettings>('/admin/settings');
}

/** Saves only the sent fields; the change is written to the activity log. */
export function updateAdminSettings(input: UpdateSettingsInput): Promise<AdminSettings> {
  return apiFetch<AdminSettings>('/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
