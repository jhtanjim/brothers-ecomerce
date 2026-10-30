'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminOrder } from '@/lib/api/admin-orders';
import { createOrderReturn } from '@/lib/api/admin-returns';
import { ApiError } from '@/lib/api/client';
import type { AdminOrderDetail, PaymentMethod } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

type Outcome = 'EXCHANGE' | PaymentMethod;

const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'EXCHANGE', label: 'Exchange' },
  { value: 'CASH', label: 'Refund cash' },
  { value: 'BKASH', label: 'Refund bKash' },
  { value: 'NAGAD', label: 'Refund Nagad' },
];

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ret-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function cents(value: string): number {
  return Math.round(Number(value) * 100);
}

/** Same calculation as refundForLine in the backend, which has the final say. */
function estimateCents(order: AdminOrderDetail, itemId: string, quantity: number): number {
  const item = order.items.find((entry) => entry.id === itemId);
  if (!item || quantity < 1) return 0;
  const itemsTotal = order.items.reduce((sum, entry) => sum + cents(entry.totalPrice), 0);
  const line = cents(item.totalPrice);
  const share = itemsTotal > 0 ? Math.round((cents(order.couponDiscount) * line) / itemsTotal) : 0;
  const paid = line - share;
  if (item.returnedQuantity + quantity >= item.quantity) {
    return Math.max(0, paid - cents(item.returnedAmount));
  }
  return Math.round((paid * quantity) / item.quantity);
}

/** Choose what came back, then either refund it or carry its value to a new sale. */
export function ReturnContent({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const [outcome, setOutcome] = useState<Outcome>('EXCHANGE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kept across retries, so a repeated submit can never process the return twice.
  const key = useRef(newKey());

  useEffect(() => {
    let cancelled = false;
    getAdminOrder(orderId)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (failed) {
    return <ErrorState title="Could not load this order" message="It may not exist." />;
  }
  if (!order) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />;
  }

  const eligible = order.status === 'DELIVERED' && order.paymentStatus === 'APPROVED';
  const chosen = order.items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const totalCents = chosen.reduce(
    (sum, item) => sum + estimateCents(order, item.id, quantities[item.id] ?? 0),
    0,
  );
  const canSubmit = eligible && chosen.length > 0 && reason.trim().length >= 3 && !busy;

  async function onSubmit() {
    if (!canSubmit || !order) return;
    setBusy(true);
    setError(null);
    try {
      const made = await createOrderReturn(
        order.id,
        {
          items: chosen.map((item) => ({
            orderItemId: item.id,
            quantity: quantities[item.id] ?? 0,
          })),
          reason: reason.trim(),
          restock,
          ...(outcome === 'EXCHANGE' ? {} : { refundMethod: outcome }),
        },
        key.current,
      );
      router.push(
        outcome === 'EXCHANGE'
          ? `/admin/pos?credit=${encodeURIComponent(made.id)}`
          : `/admin/pos/returns/${encodeURIComponent(made.id)}?print=1`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) key.current = newKey();
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Unable to reach the server. Please try again.',
      );
      setBusy(false);
    }
  }

  if (!eligible) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only paid, completed orders can be returned.
        </p>
        <Link
          href={`/admin/orders/${encodeURIComponent(order.id)}`}
          className="text-sm font-medium text-brand-600"
        >
          Back to the order
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-600">
        Order {order.orderNumber}, {order.shipping.name}
      </p>

      <ul className="divide-y divide-slate-100">
        {order.items.map((item) => {
          const left = item.quantity - item.returnedQuantity;
          const quantity = quantities[item.id] ?? 0;
          const set = (next: number) =>
            setQuantities((current) => ({
              ...current,
              [item.id]: Math.max(0, Math.min(next, left)),
            }));
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">{item.name}</p>
                {optionLabel(item.size, item.color) ? (
                  <p className="text-slate-600">{optionLabel(item.size, item.color)}</p>
                ) : null}
                <p className="text-slate-500">
                  Bought {item.quantity}
                  {item.returnedQuantity > 0 ? `, already returned ${item.returnedQuantity}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Return one fewer ${item.name}`}
                  disabled={quantity <= 0}
                  onClick={() => set(quantity - 1)}
                  className="h-11 w-11 border border-slate-300 text-lg disabled:opacity-40"
                >
                  -
                </button>
                <span aria-live="polite" className="w-8 text-center text-sm font-medium">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Return one more ${item.name}`}
                  disabled={quantity >= left}
                  onClick={() => set(quantity + 1)}
                  className="h-11 w-11 border border-slate-300 text-lg disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <label htmlFor="returnReason" className="mb-1 block text-sm font-medium text-slate-700">
          Reason
        </label>
        <input
          id="returnReason"
          value={reason}
          maxLength={500}
          placeholder="Wrong size"
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={restock}
          onChange={(e) => setRestock(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        Put these items back in stock. Untick this for damaged items.
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          What does the customer get?
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OUTCOMES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={outcome === option.value}
              onClick={() => setOutcome(option.value)}
              className={`min-h-11 border px-2 text-sm font-semibold ${
                outcome === option.value
                  ? 'border-brand-950 bg-brand-950 text-white'
                  : 'border-slate-300 text-slate-800 hover:border-brand-950'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {outcome === 'EXCHANGE'
            ? 'Next, you pick the new items in the POS. This value pays towards them.'
            : 'Give the money back yourself. The system only records it.'}
        </p>
      </fieldset>

      <p className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
        <span>{outcome === 'EXCHANGE' ? 'Exchange credit' : 'Refund'}</span>
        <span>{formatPrice((totalCents / 100).toFixed(2))}</span>
      </p>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void onSubmit()}
        className="min-h-12 w-full bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? 'Saving...'
          : outcome === 'EXCHANGE'
            ? 'Save and choose new items'
            : 'Save refund and print slip'}
      </button>
    </div>
  );
}
