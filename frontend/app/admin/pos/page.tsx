import type { Metadata } from 'next';
import { PosContent } from '@/components/admin/PosContent';

export const metadata: Metadata = { title: 'POS' };

export default function AdminPosPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point of sale</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sell to customers in the shop. Stock goes down as soon as the sale is complete.
      </p>
      <div className="mt-6">
        <PosContent />
      </div>
    </div>
  );
}
