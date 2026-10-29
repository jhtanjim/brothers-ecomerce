import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductsListContent } from '@/components/admin/ProductsListContent';

export const metadata: Metadata = { title: 'Products' };

export default function AdminProductsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
      <p className="mt-1 text-sm text-slate-600">Manage the catalog, prices, stock and images.</p>
      <div className="mt-6">
        {/* useSearchParams (filters and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <ProductsListContent />
        </Suspense>
      </div>
    </div>
  );
}
