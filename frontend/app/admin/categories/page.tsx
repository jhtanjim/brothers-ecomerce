import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CategoriesListContent } from '@/components/admin/CategoriesListContent';

export const metadata: Metadata = { title: 'Categories' };

export default function AdminCategoriesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h1>
      <p className="mt-1 text-sm text-slate-600">Create and manage catalog categories.</p>
      <div className="mt-6">
        {/* useSearchParams (filters and page) requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <CategoriesListContent />
        </Suspense>
      </div>
    </div>
  );
}
