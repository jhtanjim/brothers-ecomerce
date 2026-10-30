'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { paymentMethodLabel } from '@/components/order/StatusBadges';
import { ErrorState } from '@/components/ui/ErrorState';
import { getOrderReturn } from '@/lib/api/admin-returns';
import type { OrderReturn } from '@/lib/api/types';
import { formatPrice, optionLabel, SITE_NAME } from '@/lib/format';

const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 3mm; }
  body * { visibility: hidden; }
  #return-slip, #return-slip * { visibility: visible; color: #000 !important; }
  #return-slip { position: absolute; left: 0; top: 0; width: 74mm; border: 0; padding: 0; }
}`;

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function ReturnSlipContent({ id, autoPrint }: { id: string; autoPrint: boolean }) {
  const [slip, setSlip] = useState<OrderReturn | null>(null);
  const [failed, setFailed] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getOrderReturn(id)
      .then((result) => {
        if (!cancelled) setSlip(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (autoPrint && slip && !printed.current) {
      printed.current = true;
      window.print();
    }
  }, [autoPrint, slip]);

  if (failed) {
    return <ErrorState title="Could not load this return" message="It may not exist." />;
  }
  if (!slip) {
    return <div className="h-64 max-w-sm animate-pulse rounded-xl bg-slate-200" aria-busy="true" />;
  }

  const unusedCredit = slip.refundMethod === null && slip.exchangeOrderId === null;

  return (
    <div className="space-y-5">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap gap-3 print:hidden">
        {unusedCredit ? (
          <Link
            href={`/admin/pos?credit=${encodeURIComponent(slip.id)}`}
            className="inline-flex min-h-11 items-center bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Use credit in POS
          </Link>
        ) : (
          <Link
            href="/admin/pos"
            className="inline-flex min-h-11 items-center bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New sale
          </Link>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 border border-slate-400 px-5 text-sm font-semibold text-slate-900 hover:border-slate-900"
        >
          Print slip
        </button>
        <Link
          href={`/admin/orders/${encodeURIComponent(slip.orderId)}`}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          View order
        </Link>
      </div>

      <div
        id="return-slip"
        className="w-[302px] max-w-full border border-slate-200 bg-white p-4 font-sans text-xs leading-snug text-black"
      >
        <p className="text-center font-display text-2xl font-semibold tracking-[0.25em]">
          {SITE_NAME}
        </p>
        <p className="mt-1 text-center font-semibold">RETURN SLIP</p>
        <div className="mt-3 border-t border-dashed border-black pt-2">
          <p>Return: {slip.returnNumber}</p>
          <p>{dateTime.format(new Date(slip.createdAt))}</p>
          <p>Original sale: {slip.orderNumber}</p>
          <p>Customer: {slip.customerName}</p>
          <p>Reason: {slip.reason}</p>
        </div>
        <ul className="mt-2 space-y-2 border-t border-dashed border-black pt-2">
          {slip.items.map((item) => (
            <li key={item.id}>
              <p className="font-medium">{item.name}</p>
              {optionLabel(item.size, item.color) ? (
                <p>{optionLabel(item.size, item.color)}</p>
              ) : null}
              <div className="flex justify-between gap-2">
                <span>Returned {item.quantity}</span>
                <span>{formatPrice(item.amount)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between gap-2 border-t border-dashed border-black pt-2 text-sm font-bold">
          <span>
            {slip.refundMethod
              ? `Refund by ${paymentMethodLabel(slip.refundMethod)}`
              : 'Exchange credit'}
          </span>
          <span>{formatPrice(slip.refundAmount)}</span>
        </div>
      </div>
    </div>
  );
}
