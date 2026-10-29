import type { Metadata } from 'next';
import { CouponEditContent } from '@/components/admin/CouponEditContent';

export const metadata: Metadata = { title: 'Edit coupon' };

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit coupon</h1>
      <div className="mt-6">
        <CouponEditContent id={id} />
      </div>
    </div>
  );
}
