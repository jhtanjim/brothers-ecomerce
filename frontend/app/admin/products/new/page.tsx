import type { Metadata } from 'next';
import { ProductForm } from '@/components/admin/ProductForm';

export const metadata: Metadata = { title: 'New product' };

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">New product</h1>
      <p className="mt-1 text-sm text-slate-600">
        Images can be added right after the product is created.
      </p>
      <div className="mt-6">
        <ProductForm product={null} />
      </div>
    </div>
  );
}
