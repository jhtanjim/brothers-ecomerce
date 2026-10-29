import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersListContent } from '@/components/admin/OrdersListContent';

export const metadata: Metadata = { title: 'Orders' };

export default function AdminOrdersPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
      <p className="mt-1 text-sm text-slate-600">All customer orders. Open one to manage its status.</p>
      <div className="mt-6">
        {/* useSearchParams (filters and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <OrdersListContent />
        </Suspense>
      </div>
    </div>
  );
}