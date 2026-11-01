import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/InfoPage';
import { formatPrice } from '@/lib/format';
import { store } from '@/lib/store';

export const metadata: Metadata = { title: 'Delivery' };

export default function DeliveryPage() {
  const { insideDhaka, outsideDhaka, freeFrom } = store.delivery;
  return (
    <InfoPage title="Delivery">
      <ul className="divide-y divide-slate-200 border-y border-slate-200">
        <li className="flex justify-between gap-4 py-3">
          <span>Inside Dhaka</span>
          <span className="font-semibold text-slate-900">{formatPrice(insideDhaka)}</span>
        </li>
        <li className="flex justify-between gap-4 py-3">
          <span>Outside Dhaka</span>
          <span className="font-semibold text-slate-900">{formatPrice(outsideDhaka)}</span>
        </li>
        <li className="flex justify-between gap-4 py-3">
          <span>Orders of {formatPrice(freeFrom)} or more</span>
          <span className="font-semibold text-slate-900">Free</span>
        </li>
      </ul>
      <p>Checkout shows the exact charge for your address before you place the order.</p>
      <p>You can follow your order at any time from your account, under Track my orders.</p>
    </InfoPage>
  );
}
