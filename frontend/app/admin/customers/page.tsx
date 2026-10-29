import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CustomersListContent } from '@/components/admin/CustomersListContent';

export const metadata: Metadata = { title: 'Customers' };

export default function AdminCustomersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
      <p className="mt-1 text-sm text-slate-600">
        Find customer accounts and suspend or reactivate them. Admin accounts are not listed here.
      </p>
      <div className="mt-6">
        {/* useSearchParams (filters and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <CustomersListContent />
        </Suspense>
      </div>
    </div>
  );
}
