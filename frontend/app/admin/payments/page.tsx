import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentsQueueContent } from '@/components/admin/PaymentsQueueContent';

export const metadata: Metadata = { title: 'Payments' };

export default function AdminPaymentsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
      <p className="mt-1 text-sm text-slate-600">Review the payment details customers submitted.</p>
      <div className="mt-6">
        {/* useSearchParams (status and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <PaymentsQueueContent />
        </Suspense>
      </div>
    </div>
  );
}
