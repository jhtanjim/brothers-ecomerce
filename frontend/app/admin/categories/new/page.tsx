import type { Metadata } from 'next';
import { CategoryForm } from '@/components/admin/CategoryForm';

export const metadata: Metadata = { title: 'New category' };

export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">New category</h1>
      <div className="mt-6">
        <CategoryForm category={null} />
      </div>
    </div>
  );
}
