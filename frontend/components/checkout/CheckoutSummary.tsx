import Image from 'next/image';
import type { CartView, ValidateCouponResult } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

interface CheckoutSummaryProps {
  cart: CartView;
  /** Preview of an applied coupon; the backend recalculates when the order is placed. */
  coupon?: ValidateCouponResult | null;
}

/** Read-only view of the server-side cart. Every amount shown here comes from the backend. */
export function CheckoutSummary({ cart, coupon = null }: CheckoutSummaryProps) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
      <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {cart.items.map((line) => (
          <li key={line.id} className="flex gap-3 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-slate-900">{line.name}</p>
              <p className="text-xs text-slate-500">
                {line.quantity} x {formatPrice(line.unitPrice)}
              </p>
              {line.issue ? (
                <p className="text-xs font-medium text-amber-700">Needs attention in your cart</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm font-medium text-slate-900">
              {formatPrice(line.lineTotal)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-4 text-sm">
        <dt className="text-slate-600">
          Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
        </dt>
        <dd className="text-base font-semibold text-slate-900">{formatPrice(cart.subtotal)}</dd>
      </dl>
      {coupon ? (
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-slate-600">Coupon ({coupon.code})</dt>
            <dd className="font-medium text-emerald-700">-{formatPrice(coupon.discount)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
            <dt className="text-slate-600">Before delivery</dt>
            <dd className="text-base font-semibold text-slate-900">
              {formatPrice(coupon.payable)}
            </dd>
          </div>
        </dl>
      ) : null}{' '}
      <p className="mt-2 text-xs text-slate-500">
        The delivery charge is added when you place the order and depends on your city. The final
        total is shown on your order.
      </p>
    </aside>
  );
}
