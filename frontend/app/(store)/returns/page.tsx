import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/InfoPage';
import { store } from '@/lib/store';

export const metadata: Metadata = { title: 'Exchange and return' };

export default function ReturnsPage() {
  return (
    <InfoPage title="Exchange and return">
      <p>
        You can return or exchange an item within <strong>{store.returnDays} days</strong> of
        receiving it. Contact us within that time.
      </p>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Conditions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The item has not been worn, washed or altered.</li>
          <li>All tags are still attached.</li>
          <li>You have your receipt or order number.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Items we cannot take back</h2>
        <p className="mt-2">Items that were worn, washed, altered or damaged after delivery.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Delivery charge</h2>
        <p className="mt-2">
          If we sent the wrong or a faulty item, we pay the delivery. For a change of size or mind,
          you pay it.
        </p>
      </section>
    </InfoPage>
  );
}
