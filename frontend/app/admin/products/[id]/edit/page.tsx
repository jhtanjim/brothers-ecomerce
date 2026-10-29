import type { Metadata } from 'next';
import { ProductEditContent } from '@/components/admin/ProductEditContent';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit product</h1>
      <div className="mt-6">
        <ProductEditContent id={id} created={created === '1'} />
      </div>
    </div>
  );
}
