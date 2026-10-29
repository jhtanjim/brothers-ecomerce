import type { Metadata } from 'next';
import { OrderManageContent } from '@/components/admin/OrderManageContent';

export const metadata: Metadata = { title: 'Manage order' };

interface ManageOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminManageOrderPage({ params }: ManageOrderPageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl">
      <OrderManageContent orderId={id} />
    </div>
  );
}