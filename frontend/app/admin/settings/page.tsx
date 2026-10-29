import type { Metadata } from 'next';
import { SettingsContent } from '@/components/admin/SettingsContent';

export const metadata: Metadata = { title: 'Settings' };

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Store settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Delivery charges, payment numbers and order rules. Every change is recorded in the activity
        log.
      </p>
      <div className="mt-6">
        <SettingsContent />
      </div>
    </div>
  );
}
