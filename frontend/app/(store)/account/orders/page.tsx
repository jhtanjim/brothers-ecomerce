import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderListContent } from '@/components/order/OrderListContent';

export const metadata: Metadata = {
  title: 'My orders',
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My orders</h1>
      <div className="mt-6">
        {/* useSearchParams (page number) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <OrderListContent />
        </Suspense>
      </div>
    </main>
  );
}