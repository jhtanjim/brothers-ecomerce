import type { Metadata } from 'next';
import { CouponForm } from '@/components/admin/CouponForm';

export const metadata: Metadata = { title: 'New coupon' };

export default function NewCouponPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">New coupon</h1>
      <div className="mt-6">
        <CouponForm coupon={null} />
      </div>
    </div>
  );
}
