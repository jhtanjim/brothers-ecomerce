import type { Metadata } from 'next';
import { LowStockContent } from '@/components/admin/LowStockContent';

export const metadata: Metadata = { title: 'Low stock' };

export default function AdminLowStockPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Low stock</h1>
      <p className="mt-1 text-sm text-slate-600">
        What to reorder, with each size and colour shown separately.
      </p>
      <div className="mt-6">
        <LowStockContent />
      </div>
    </div>
  );
}
