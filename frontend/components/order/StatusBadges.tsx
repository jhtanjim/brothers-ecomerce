import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/api/types';

const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', className: 'bg-amber-50 text-amber-800' },
  PROCESSING: { label: 'Processing', className: 'bg-indigo-50 text-indigo-700' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-indigo-50 text-indigo-700' },
  SHIPPED: { label: 'Shipped', className: 'bg-sky-50 text-sky-700' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-50 text-rose-700' },
};

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; className: string }> = {
  UNPAID: { label: 'Unpaid', className: 'bg-amber-50 text-amber-800' },
  PENDING: { label: 'Payment under review', className: 'bg-indigo-50 text-indigo-700' },
  APPROVED: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Payment rejected', className: 'bg-rose-50 text-rose-700' },
};

const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS[status].label;
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD[method];
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const entry = ORDER_STATUS[status];
  return <Badge label={entry.label} className={entry.className} />;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const entry = PAYMENT_STATUS[status];
  return <Badge label={entry.label} className={entry.className} />;
}
