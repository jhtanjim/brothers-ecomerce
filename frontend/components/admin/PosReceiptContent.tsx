'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { paymentMethodLabel } from '@/components/order/StatusBadges';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminOrder } from '@/lib/api/admin-orders';
import { voidPosSale } from '@/lib/api/admin-pos';
import { ApiError } from '@/lib/api/client';
import type { AdminOrderDetail } from '@/lib/api/types';
import { formatPrice, optionLabel, SITE_NAME } from '@/lib/format';
import { store } from '@/lib/store';

/** Prints only the receipt, on an 80mm roll. Scoped here so other admin pages print normally. */
const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 3mm; }
  body * { visibility: hidden; }
  #pos-receipt, #pos-receipt * { visibility: visible; color: #000 !important; }
  #pos-receipt { position: absolute; left: 0; top: 0; width: 74mm; border: 0; padding: 0; box-shadow: none; }
}`;

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  dateStyle: 'medium',
  timeStyle: 'short',
});

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? 'text-sm font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PosReceiptContent({ id, autoPrint }: { id: string; autoPrint: boolean }) {
  const [sale, setSale] = useState<AdminOrderDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAdminOrder(id)
      .then((order) => {
        if (!cancelled) setSale(order);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (autoPrint && sale && !printed.current) {
      printed.current = true;
      window.print();
    }
  }, [autoPrint, sale]);

  async function onVoid() {
    if (reason.trim().length < 3) {
      setVoidError('Enter a short reason.');
      return;
    }
    setBusy(true);
    setVoidError(null);
    try {
      setSale(await voidPosSale(id, reason.trim()));
      setVoidOpen(false);
    } catch (err) {
      setVoidError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Could not cancel the sale. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return <ErrorState title="Could not load this sale" message="It may not exist." />;
  }
  if (!sale) {
    return <div className="h-64 max-w-sm animate-pulse rounded-xl bg-slate-200" aria-busy="true" />;
  }

  const cancelled = sale.status === 'CANCELLED';
  const method = sale.payment?.method;
  const transactionId = sale.payment?.submissions[0]?.transactionId;
  const change =
    sale.cashReceived !== null
      ? (
          Number(sale.cashReceived) -
          (Number(sale.totalAmount) - Number(sale.exchangeCredit))
        ).toFixed(2)
      : null;

  return (
    <div className="space-y-5">
      <style>{PRINT_CSS}</style>

      <div className="flex flex-wrap gap-3 print:hidden">
        <Link
          href="/admin/pos"
          className="inline-flex min-h-11 items-center bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          New sale
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 border border-slate-400 px-5 text-sm font-semibold text-slate-900 hover:border-slate-900"
        >
          Print receipt
        </button>
        <Link
          href={`/admin/orders/${encodeURIComponent(sale.id)}`}
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          View order
        </Link>
        {!cancelled ? (
          <Link
            href={`/admin/orders/${encodeURIComponent(sale.id)}/return`}
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Return or exchange
          </Link>
        ) : null}
        {!cancelled && sale.returns.length === 0 ? (
          <button
            type="button"
            onClick={() => setVoidOpen((open) => !open)}
            className="ml-auto min-h-11 px-2 text-sm font-medium text-rose-600"
          >
            Cancel this sale
          </button>
        ) : null}
      </div>

      {voidOpen ? (
        <div className="max-w-sm space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4 print:hidden">
          <label htmlFor="voidReason" className="block text-sm font-medium text-slate-800">
            Why is this sale being cancelled?
          </label>
          <input
            id="voidReason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-600">
            All items go back into stock. Give the customer their cash back yourself.
          </p>
          {voidError ? (
            <p role="alert" className="text-sm text-rose-700">
              {voidError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onVoid()}
            className="min-h-11 bg-rose-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Cancelling...' : 'Confirm cancel'}
          </button>
        </div>
      ) : null}

      <div
        id="pos-receipt"
        className="w-[302px] max-w-full border border-slate-200 bg-white p-4 font-sans text-xs leading-snug text-black"
      >
        <p className="text-center font-display text-2xl font-semibold tracking-[0.25em]">
          {SITE_NAME}
        </p>
        {store.contact.address ? <p className="text-center">{store.contact.address}</p> : null}
        {store.contact.phone ? <p className="text-center">{store.contact.phone}</p> : null}

        {cancelled ? (
          <p className="mt-2 border border-black py-1 text-center text-sm font-bold">CANCELLED</p>
        ) : null}

        <div className="mt-3 border-t border-dashed border-black pt-2">
          <p>Receipt: {sale.orderNumber}</p>
          <p>{dateTime.format(new Date(sale.createdAt))}</p>
          <p>Customer: {sale.shipping.name}</p>
          {sale.shipping.phone ? <p>Phone: {sale.shipping.phone}</p> : null}
        </div>

        <ul className="mt-2 space-y-2 border-t border-dashed border-black pt-2">
          {sale.items.map((item) => (
            <li key={item.id}>
              <p className="font-medium">{item.name}</p>
              {optionLabel(item.size, item.color) ? (
                <p>{optionLabel(item.size, item.color)}</p>
              ) : null}
              <div className="flex justify-between gap-2">
                <span>
                  {item.quantity} x{' '}
                  {formatPrice((Number(item.totalPrice) / item.quantity).toFixed(2))}
                </span>
                <span>{formatPrice(item.totalPrice)}</span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-2 space-y-1 border-t border-dashed border-black pt-2">
          {Number(sale.couponDiscount) > 0 ? (
            <>
              <Row
                label="Items"
                value={formatPrice(
                  (Number(sale.totalAmount) + Number(sale.couponDiscount)).toFixed(2),
                )}
              />
              <Row label="Discount" value={`-${formatPrice(sale.couponDiscount)}`} />
            </>
          ) : null}
          <Row label="Total" value={formatPrice(sale.totalAmount)} strong />
          {Number(sale.exchangeCredit) > 0 ? (
            <Row label="Exchange credit" value={`-${formatPrice(sale.exchangeCredit)}`} />
          ) : null}
          {sale.cashReceived !== null ? (
            <Row label="Cash" value={formatPrice(sale.cashReceived)} />
          ) : null}
          {change !== null ? <Row label="Change" value={formatPrice(change)} /> : null}
          {method && method !== 'CASH' ? (
            <>
              <Row label="Paid by" value={paymentMethodLabel(method)} />
              {transactionId ? <Row label="Transaction" value={transactionId} /> : null}
            </>
          ) : null}
        </dl>

        <p className="mt-3 border-t border-dashed border-black pt-2 text-center">
          Thank you for shopping with {SITE_NAME}
        </p>
      </div>
    </div>
  );
}
