import Image from 'next/image';
import type { CartView, OrderQuote, ValidateCouponResult } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

interface CheckoutSummaryProps {
  cart: CartView;
  /** Preview of an applied coupon; the backend recalculates when the order is placed. */
  coupon?: ValidateCouponResult | null;
  /** Backend price preview for the entered city; null while unknown or loading. */
  quote?: OrderQuote | null;
  quoteState?: 'idle' | 'loading' | 'error';
  /** The city typed in the form ('' when none yet). */
  city?: string;
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</dt>
      <dd
        className={strong ? 'text-lg font-extrabold text-slate-900' : 'font-medium text-slate-900'}
      >
        {value}
      </dd>
    </div>
  );
}

/** Read-only view of the server-side cart. Every amount shown here comes from the backend. */
export function CheckoutSummary({
  cart,
  coupon = null,
  quote = null,
  quoteState = 'idle',
  city = '',
}: CheckoutSummaryProps) {
  const couponDiscount = quote ? quote.couponDiscount : coupon?.discount;
  const couponCode = quote ? quote.couponCode : (coupon?.code ?? null);
  const hasCity = city.trim().length >= 2;

  let delivery: string;
  if (!hasCity) delivery = 'Enter your city';
  else if (quoteState === 'loading' || (!quote && quoteState === 'idle'))
    delivery = 'Calculating...';
  else if (quoteState === 'error' || !quote || quote.deliveryCharge === null)
    delivery = 'Shown on your order';
  else delivery = Number(quote.deliveryCharge) === 0 ? 'Free' : formatPrice(quote.deliveryCharge);

  const total = hasCity && quoteState === 'idle' && quote?.total ? quote.total : null;

  // "Add X more for free delivery", computed from backend amounts only.
  let freeDeliveryGap: number | null = null;
  if (
    quote?.freeDeliveryThreshold &&
    quote.deliveryCharge !== null &&
    Number(quote.deliveryCharge) > 0
  ) {
    const payable = Number(quote.subtotal) - Number(quote.discount) - Number(quote.couponDiscount);
    const gap = Number(quote.freeDeliveryThreshold) - payable;
    if (gap > 0) freeDeliveryGap = gap;
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:sticky lg:top-36">
      <h2 className="text-lg font-bold text-slate-900">Order summary</h2>
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
              {optionLabel(line.size, line.color) ? (
                <p className="text-xs text-slate-600">{optionLabel(line.size, line.color)}</p>
              ) : null}
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

      <dl className="mt-2 space-y-2 border-t border-slate-200 pt-4 text-sm">
        <Row
          label={`Subtotal (${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'})`}
          value={formatPrice(cart.subtotal)}
        />
        {couponCode && couponDiscount && Number(couponDiscount) > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-600">Coupon ({couponCode})</dt>
            <dd className="font-medium text-emerald-700">-{formatPrice(couponDiscount)}</dd>
          </div>
        ) : null}
        <Row label={hasCity ? `Delivery to ${city.trim()}` : 'Delivery'} value={delivery} />
        <div className="border-t border-slate-200 pt-3">
          <Row label="Total" value={total ? formatPrice(total) : '-'} strong />
        </div>
      </dl>

      {quote?.couponError && coupon ? (
        <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Coupon {coupon.code}: {quote.couponError.message}
        </p>
      ) : null}
      {freeDeliveryGap !== null ? (
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Add {formatPrice(freeDeliveryGap.toFixed(2))} more to get free delivery.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500" aria-live="polite">
        {total
          ? 'This is the amount to pay. It is confirmed when you place the order.'
          : 'The delivery charge depends on your city. Enter it to see the total.'}
      </p>
    </aside>
  );
}
