import type { Metadata } from 'next';
import { CategoryEditContent } from '@/components/admin/CategoryEditContent';

export const metadata: Metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit category</h1>
      <div className="mt-6">
        <CategoryEditContent id={id} />
      </div>
    </div>
  );
}
