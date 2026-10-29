import type { Metadata } from 'next';
import { CartPageContent } from '@/components/cart/CartPageContent';

export const metadata: Metadata = {
  title: 'Shopping cart',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Shopping cart</h1>
      <div className="mt-6">
        <CartPageContent />
      </div>
    </main>
  );
}