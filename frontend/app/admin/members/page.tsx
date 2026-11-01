import type { Metadata } from 'next';
import { MembersContent } from '@/components/admin/MembersContent';

export const metadata: Metadata = { title: 'Members' };

export default function AdminMembersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Members</h1>
      <p className="mt-1 text-sm text-slate-600">
        Members get 5% off in the shop. Enter their phone number on the POS and it applies by
        itself.
      </p>
      <div className="mt-6">
        <MembersContent />
      </div>
    </div>
  );
}
