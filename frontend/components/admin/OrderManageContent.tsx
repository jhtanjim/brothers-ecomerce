'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  orderStatusLabel,
  paymentMethodLabel,
} from '@/components/order/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminOrder, updateAdminOrderStatus } from '@/lib/api/admin-orders';
import { ApiError } from '@/lib/api/client';
import type { AdminOrderDetail, AdminOrderStatusResult, OrderStatus } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/orders';
/** Same rule as the backend DTO (the backend stays the authority). */
const REASON_MIN = 3;
const REASON_MAX = 500;

interface NextStep {
  to: OrderStatus;
  label: string;
  done: string;
  noteAllowed: boolean;
}

/** Button visibility only. The backend enforces the real transition table (409 INVALID_STATUS_TRANSITION). */
const NEXT_STEP: Partial<Record<OrderStatus, NextStep>> = {
  PROCESSING: {
    to: 'CONFIRMED',
    label: 'Mark confirmed',
    done: 'Order marked as confirmed.',
    noteAllowed: false,
  },
  CONFIRMED: {
    to: 'SHIPPED',
    label: 'Mark shipped',
    done: 'Order marked as shipped.',
    noteAllowed: true,
  },
  SHIPPED: {
    to: 'DELIVERED',
    label: 'Mark delivered',
    done: 'Order marked as delivered.',
    noteAllowed: false,
  },
};

const CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'PROCESSING', 'CONFIRMED'];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; order: AdminOrderDetail }
  | { kind: 'not-found' }
  | { kind: 'error' };

interface Notice {
  tone: 'success' | 'error';
  text: string;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0)
    return 'Unable to reach the server. Please check your connection and try again.';
  if (err.status === 401) return 'Your session has expired. Please sign in again.';
  if (err.status === 403) return 'You do not have permission to do this.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err.message;
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-40 rounded-xl bg-slate-200" />
      <div className="h-40 rounded-xl bg-slate-200" />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
    </div>
  );
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-5';
const textareaClass =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 border-slate-300 focus:border-brand-600 focus:ring-brand-100';

export function OrderManageContent({ orderId }: { orderId: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminOrder(orderId)
      .then((order) => {
        if (!cancelled) setState({ kind: 'ready', order });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof ApiError && err.status === 404 ? { kind: 'not-found' } : { kind: 'error' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, attempt]);

  /** Re-reads the order without the loading skeleton. A failed refresh keeps the current view. */
  const refresh = useCallback(() => {
    getAdminOrder(orderId)
      .then((order) => {
        if (mountedRef.current) setState({ kind: 'ready', order });
      })
      .catch(() => {
        // Keep showing the last loaded order.
      });
  }, [orderId]);

  async function run(
    action: () => Promise<AdminOrderStatusResult>,
    successText: (result: AdminOrderStatusResult) => string,
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();
      setNotice({ tone: 'success', text: successText(result) });
      setCancelOpen(false);
      setReason('');
      setNote('');
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      // Also after an error (for example a 409), so the page shows the real state.
      refresh();
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onAdvance(step: NextStep) {
    let trimmed: string | undefined;
    if (step.noteAllowed) {
      const text = note.trim();
      if (text && (text.length < REASON_MIN || text.length > REASON_MAX)) {
        setNoteError(
          `A note must be ${REASON_MIN} to ${REASON_MAX} characters (or leave it empty)`,
        );
        return;
      }
      trimmed = text || undefined;
    }
    setNoteError(null);
    void run(
      () => updateAdminOrderStatus(orderId, step.to, trimmed),
      () => step.done,
    );
  }

  function onCancel() {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setReasonError(`Enter a reason of ${REASON_MIN} to ${REASON_MAX} characters`);
      return;
    }
    setReasonError(null);
    void run(
      () => updateAdminOrderStatus(orderId, 'CANCELLED', trimmed),
      (result) =>
        result.refundNeeded
          ? 'Order cancelled and stock restored. This order was paid, so refund the customer manually.'
          : 'Order cancelled and stock restored.',
    );
  }

  if (state.kind === 'loading') return <PageSkeleton />;

  if (state.kind === 'not-found') {
    return (
      <div className="space-y-4">
        <EmptyState title="Order not found" message="This order does not exist." />
        <div className="text-center">
          <Link href={LIST_PATH} className="font-medium text-brand-600 hover:text-brand-700">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load this order"
          message="Please check your connection and try again."
        />
        <div className="text-center">
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { order } = state;
  const step = NEXT_STEP[order.status];
  const canCancel = CANCELLABLE.includes(order.status);
  const hasActions = Boolean(step) || canCancel;
  const underReview = order.paymentStatus === 'PENDING';
  const paid = order.paymentStatus === 'APPROVED';

  return (
    <div className="space-y-6">
      <div>
        <Link href={LIST_PATH} className="text-sm text-slate-600 hover:text-brand-600">
          &larr; Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Order {order.orderNumber}
          </h1>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {order.channel === 'POS' ? 'Sold at the shop' : 'Placed'}{' '}
          {formatDateTime(order.createdAt)}
          {order.channel === 'POS' ? (
            <>
              {' '}
              <Link
                href={`/admin/pos/receipts/${encodeURIComponent(order.id)}`}
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Receipt
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <section aria-labelledby="actions-heading" className={cardClass}>
        <h2 id="actions-heading" className="text-lg font-semibold text-slate-900">
          Actions
        </h2>

        {!hasActions ? (
          <p className="mt-2 text-sm text-slate-600">
            No further actions. This order is {orderStatusLabel(order.status).toLowerCase()}.
          </p>
        ) : null}

        {order.status === 'PENDING_PAYMENT' ? (
          <p className="mt-2 text-sm text-slate-600">
            {underReview ? (
              <>
                A payment is waiting for review.{' '}
                {order.payment?.submissions.length ? (
                  <Link
                    href={`/admin/payments/${encodeURIComponent(order.payment.submissions[order.payment.submissions.length - 1].id)}`}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Review the payment
                  </Link>
                ) : null}{' '}
                to move this order to Processing.
              </>
            ) : (
              'This order moves to Processing when its payment is approved.'
            )}
          </p>
        ) : null}

        {step ? (
          <div className="mt-4">
            {step.noteAllowed ? (
              <div className="mb-3 max-w-md">
                <label htmlFor="stepNote" className="mb-1 block text-sm font-medium text-slate-700">
                  Note (optional, for example a courier name or tracking number)
                </label>
                <textarea
                  id="stepNote"
                  rows={2}
                  maxLength={REASON_MAX}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setNoteError(null);
                  }}
                  aria-invalid={noteError ? true : undefined}
                  className={textareaClass}
                />
                {noteError ? <p className="mt-1 text-xs text-rose-600">{noteError}</p> : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => onAdvance(step)}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Working...' : step.label}
            </button>
          </div>
        ) : null}

        {canCancel ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            {cancelOpen ? (
              <div
                role="alertdialog"
                aria-label="Confirm cancellation"
                className="max-w-xl rounded-lg bg-rose-50 p-4 text-sm"
              >
                <p className="font-medium text-rose-900">Cancel this order?</p>
                <p className="mt-1 text-rose-800">
                  The items go back in stock. This cannot be undone.
                </p>
                {paid ? (
                  <p className="mt-2 rounded bg-white px-3 py-2 text-rose-800">
                    This order is paid. The payment stays recorded as approved and you must refund
                    the customer manually.
                  </p>
                ) : null}
                {underReview ? (
                  <p className="mt-2 rounded bg-white px-3 py-2 text-rose-800">
                    A payment is under review. Cancelling closes it as rejected.
                  </p>
                ) : null}
                <label htmlFor="cancelReason" className="mb-1 mt-3 block font-medium text-rose-900">
                  Reason (saved on the order)
                </label>
                <textarea
                  id="cancelReason"
                  rows={3}
                  maxLength={REASON_MAX}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setReasonError(null);
                  }}
                  aria-invalid={reasonError ? true : undefined}
                  className={textareaClass}
                />
                <div className="mt-1 flex justify-between text-xs">
                  {reasonError ? <p className="text-rose-600">{reasonError}</p> : <span />}
                  <span className="text-slate-500">
                    {reason.trim().length}/{REASON_MAX}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? 'Cancelling...' : 'Yes, cancel order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelOpen(false);
                      setReasonError(null);
                    }}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Keep order
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                Cancel order
              </button>
            )}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="items-heading" className={cardClass}>
            <h2 id="items-heading" className="text-lg font-semibold text-slate-900">
              Items
            </h2>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium text-slate-900">{item.name}</p>
                    {optionLabel(item.size, item.color) ? (
                      <p className="text-xs font-medium text-slate-700">
                        {optionLabel(item.size, item.color)}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-500">SKU {item.sku}</p>
                    <p className="mt-1 text-slate-600">
                      {item.quantity} x {formatPrice(item.unitPrice)}
                    </p>
                    {Number(item.discountAmount) > 0 ? (
                      <p className="text-xs font-medium text-rose-600">
                        Discount -{formatPrice(item.discountAmount)}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-semibold text-slate-900">
                    {formatPrice(item.totalPrice)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="timeline-heading" className={cardClass}>
            <h2 id="timeline-heading" className="text-lg font-semibold text-slate-900">
              Timeline
            </h2>
            <ol className="mt-3 space-y-3">
              {order.timeline.map((entry, index) => (
                <li key={`${entry.toStatus}-${entry.createdAt}-${index}`} className="text-sm">
                  <p className="font-medium text-slate-900">{orderStatusLabel(entry.toStatus)}</p>
                  {entry.note ? <p className="text-slate-600">{entry.note}</p> : null}
                  <p className="text-xs text-slate-500">
                    {formatDateTime(entry.createdAt)} &middot; {entry.changedBy ?? 'System'}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="totals-heading" className={cardClass}>
            <h2 id="totals-heading" className="text-lg font-semibold text-slate-900">
              Totals
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <DetailRow label="Subtotal">{formatPrice(order.subtotal)}</DetailRow>
              {Number(order.discountAmount) > 0 ? (
                <DetailRow label="Discount">
                  <span className="text-rose-600">-{formatPrice(order.discountAmount)}</span>
                </DetailRow>
              ) : null}
              {Number(order.couponDiscount) > 0 ? (
                <DetailRow
                  label={
                    order.couponCode
                      ? `Coupon (${order.couponCode})`
                      : order.channel === 'POS'
                        ? 'Sale discount'
                        : 'Coupon'
                  }
                >
                  <span className="text-rose-600">-{formatPrice(order.couponDiscount)}</span>
                </DetailRow>
              ) : null}
              {order.channel === 'POS' ? null : (
                <DetailRow label="Delivery">{formatPrice(order.deliveryCharge)}</DetailRow>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="text-base font-bold text-slate-900">
                  {formatPrice(order.totalAmount)}
                </dd>
              </div>
            </dl>
          </section>

          {order.status === 'DELIVERED' && order.paymentStatus === 'APPROVED' ? (
            <section aria-labelledby="returns-heading" className={cardClass}>
              <h2 id="returns-heading" className="text-lg font-semibold text-slate-900">
                Returns
              </h2>
              {order.returns.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nothing has been returned.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {order.returns.map((entry) => (
                    <li key={entry.id} className="py-2">
                      <Link
                        href={`/admin/pos/returns/${encodeURIComponent(entry.id)}`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                      >
                        {entry.returnNumber}
                      </Link>
                      <p className="text-slate-600">
                        {formatPrice(entry.refundAmount)}{' '}
                        {entry.refundMethod
                          ? `refunded by ${paymentMethodLabel(entry.refundMethod)}`
                          : entry.exchangeOrderId
                            ? 'exchanged'
                            : 'credit not used yet'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/admin/orders/${encodeURIComponent(order.id)}/return`}
                className="mt-3 inline-flex min-h-11 items-center border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:border-slate-500"
              >
                Return or exchange
              </Link>
            </section>
          ) : null}

          <section aria-labelledby="payment-heading" className={cardClass}>
            <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
              Payment
            </h2>
            {order.payment ? (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Method">{paymentMethodLabel(order.payment.method)}</DetailRow>
                  <DetailRow label="Status">
                    <PaymentStatusBadge status={order.payment.status} />
                  </DetailRow>
                  <DetailRow label="Amount">{formatPrice(order.payment.amount)}</DetailRow>
                  <DetailRow label="Attempts">{order.payment.attemptCount}</DetailRow>
                </dl>
                {order.payment.submissions.length > 0 ? (
                  <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 text-sm">
                    {order.payment.submissions.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div>
                          <Link
                            href={`/admin/payments/${encodeURIComponent(entry.id)}`}
                            className="font-mono text-brand-600 hover:text-brand-700"
                          >
                            {entry.transactionId}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(entry.submittedAt)}
                          </p>
                          {entry.rejectionReason ? (
                            <p className="text-xs text-rose-700">Reason: {entry.rejectionReason}</p>
                          ) : null}
                        </div>
                        <PaymentStatusBadge status={entry.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No payment submitted yet.</p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No payment record.</p>
            )}
            {order.status === 'PENDING_PAYMENT' && order.expiresAt ? (
              <p className="mt-3 text-xs text-slate-500">
                Unpaid order expires {formatDateTime(order.expiresAt)}.
              </p>
            ) : null}
            {order.cancellationReason ? (
              <p className="mt-3 text-sm text-rose-700">
                Cancelled{order.cancelledAt ? ` ${formatDateTime(order.cancelledAt)}` : ''}:{' '}
                {order.cancellationReason}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="customer-heading" className={cardClass}>
            <h2 id="customer-heading" className="text-lg font-semibold text-slate-900">
              Customer and shipping
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <DetailRow label="Account">{order.customer.name}</DetailRow>
              <DetailRow label="Account email">{order.customer.email}</DetailRow>
            </dl>
            <address className="mt-3 space-y-0.5 border-t border-slate-100 pt-3 text-sm not-italic text-slate-700">
              <p className="font-medium text-slate-900">{order.shipping.name}</p>
              <p>{order.shipping.phone}</p>
              <p>{order.shipping.email}</p>
              <p>{order.shipping.address}</p>
              <p>
                {order.shipping.area}, {order.shipping.city} {order.shipping.postalCode}
              </p>
            </address>
            {order.notes ? (
              <p className="mt-3 text-sm text-slate-600">Customer notes: {order.notes}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
