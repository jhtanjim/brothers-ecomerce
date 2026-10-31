import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PurchasesListContent } from '@/components/admin/PurchasesListContent';

export const metadata: Metadata = { title: 'Stock purchases' };

export default function AdminPurchasesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock purchases</h1>
      <p className="mt-1 text-sm text-slate-600">
        Record new stock from suppliers. Stock goes up, and buying prices feed the profit report.
      </p>
      <div className="mt-6">
        {/* useSearchParams (page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <PurchasesListContent />
        </Suspense>
      </div>
    </div>
  );
}
