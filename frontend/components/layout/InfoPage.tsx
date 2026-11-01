import type { ReactNode } from 'react';
import { store } from '@/lib/store';

/** Shared layout for the delivery, return, size and privacy pages. */
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  const { phone, whatsapp } = store.contact;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-brand-950">
        {title}
      </h1>
      <div className="mt-6 space-y-6 leading-relaxed text-slate-700">{children}</div>
      {phone ? (
        <p className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-600">
          Questions? Call{' '}
          <a href={`tel:${phone}`} className="font-medium text-brand-950 underline">
            {phone}
          </a>
          {whatsapp ? (
            <>
              {' '}
              or message us on{' '}
              <a
                href={`https://wa.me/${whatsapp}`}
                rel="noopener noreferrer"
                className="font-medium text-brand-950 underline"
              >
                WhatsApp
              </a>
            </>
          ) : null}
          .
        </p>
      ) : null}
    </div>
  );
}
