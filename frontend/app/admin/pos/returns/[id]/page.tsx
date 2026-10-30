import type { Metadata } from 'next';
import { ReturnSlipContent } from '@/components/admin/ReturnSlipContent';

export const metadata: Metadata = { title: 'Return slip' };

interface ReturnSlipPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function AdminReturnSlipPage({ params, searchParams }: ReturnSlipPageProps) {
  const { id } = await params;
  const { print } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl">
      <ReturnSlipContent id={id} autoPrint={print === '1'} />
    </div>
  );
}
