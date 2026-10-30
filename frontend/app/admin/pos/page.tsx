import type { Metadata } from 'next';
import { PosContent } from '@/components/admin/PosContent';

export const metadata: Metadata = { title: 'POS' };

interface PosPageProps {
  searchParams: Promise<{ credit?: string }>;
}

export default async function AdminPosPage({ searchParams }: PosPageProps) {
  const { credit } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point of sale</h1>
      <p className="mt-1 text-sm text-slate-600">
        Sell to customers in the shop. Stock goes down as soon as the sale is complete.
      </p>
      <div className="mt-6">
        {/* The key starts a clean sale when moving between normal and exchange sales. */}
        <PosContent key={credit ?? 'sale'} creditId={credit} />
      </div>
    </div>
  );
}
