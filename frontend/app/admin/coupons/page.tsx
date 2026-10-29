import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CouponsListContent } from '@/components/admin/CouponsListContent';

export const metadata: Metadata = { title: 'Coupons' };

export default function AdminCouponsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Coupons</h1>
      <p className="mt-1 text-sm text-slate-600">Create and manage discount codes.</p>
      <div className="mt-6">
        {/* useSearchParams (filters and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <CouponsListContent />
        </Suspense>
      </div>
    </div>
  );
}
