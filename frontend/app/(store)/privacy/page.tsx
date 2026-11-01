import type { Metadata } from 'next';
import { InfoPage } from '@/components/layout/InfoPage';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">What we keep</h2>
        <p className="mt-2">
          Your name, phone number, email and delivery address, what you ordered, and the transaction
          ID or screenshot you send for a payment.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Why we keep it</h2>
        <p className="mt-2">
          To process and deliver your orders, check payments, handle returns and contact you about
          an order.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
        <p className="mt-2">Contact us if you want your details corrected or removed.</p>
      </section>
    </InfoPage>
  );
}
