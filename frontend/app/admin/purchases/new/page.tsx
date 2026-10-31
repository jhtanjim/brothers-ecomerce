import type { Metadata } from 'next';
import { NewPurchaseContent } from '@/components/admin/NewPurchaseContent';

export const metadata: Metadata = { title: 'Add purchase' };

export default function AdminNewPurchasePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Add purchase</h1>
      <NewPurchaseContent />
    </div>
  );
}
