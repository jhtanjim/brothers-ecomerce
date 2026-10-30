import type { Metadata } from 'next';
import { ReturnContent } from '@/components/admin/ReturnContent';

export const metadata: Metadata = { title: 'Return or exchange' };

interface ReturnPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminReturnPage({ params }: ReturnPageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Return or exchange</h1>
      <ReturnContent orderId={id} />
    </div>
  );
}
