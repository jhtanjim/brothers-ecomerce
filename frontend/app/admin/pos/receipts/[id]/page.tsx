import type { Metadata } from 'next';
import { PosReceiptContent } from '@/components/admin/PosReceiptContent';

export const metadata: Metadata = { title: 'Receipt' };

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}

export default async function AdminPosReceiptPage({ params, searchParams }: ReceiptPageProps) {
  const { id } = await params;
  const { print } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl">
      <PosReceiptContent id={id} autoPrint={print === '1'} />
    </div>
  );
}
