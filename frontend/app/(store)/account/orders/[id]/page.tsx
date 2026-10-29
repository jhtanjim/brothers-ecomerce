import type { Metadata } from 'next';
import { OrderDetailContent } from '@/components/order/OrderDetailContent';

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
};

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your order</h1>
      <div className="mt-6">
        <OrderDetailContent orderId={id} />
      </div>
    </main>
  );
}