import type { Metadata } from 'next';
import { PaymentReviewContent } from '@/components/admin/PaymentReviewContent';

export const metadata: Metadata = { title: 'Review payment' };

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPaymentReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl">
      <PaymentReviewContent paymentId={id} />
    </div>
  );
}