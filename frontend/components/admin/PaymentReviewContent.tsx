'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PaymentStatusBadge, paymentMethodLabel } from '@/components/order/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { approveAdminPayment, getAdminPayment, rejectAdminPayment } from '@/lib/api/admin-payments';
import { ApiError } from '@/lib/api/client';
import type { AdminPaymentDetail } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/payments';
/** Same rule as the backend DTO (the backend stays the authority). */
const REASON_MIN = 3;
const REASON_MAX = 500;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; payment: AdminPaymentDetail }
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

export function PaymentReviewContent({ paymentId }: { paymentId: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingApprove, setConfirmingApprove] = useState(false);
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
    getAdminPayment(paymentId)
      .then((payment) => {
        if (!cancelled) setState({ kind: 'ready', payment });
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
  }, [paymentId, attempt]);

  /** Re-reads the payment without the loading skeleton. A failed refresh keeps the current view. */
  const refresh = useCallback(() => {
    getAdminPayment(paymentId)
      .then((payment) => {
        if (mountedRef.current) setState({ kind: 'ready', payment });
      })
      .catch(() => {
        // Keep showing the last loaded payment.
      });
  }, [paymentId]);

  async function run(action: () => Promise<unknown>, successText: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: 'success', text: successText });
      setConfirmingApprove(false);
      setReason('');
    } catch (err) {
      setNotice({ tone: 'error', text: describeError(err) });
    } finally {
      refresh();
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onApprove() {
    void run(
      () => approveAdminPayment(paymentId),
      'Payment approved. The order is now processing.',
    );
  }

  function onReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
      setReasonError(`Enter a reason of ${REASON_MIN} to ${REASON_MAX} characters`);
      return;
    }
    setReasonError(null);
    void run(
      () => rejectAdminPayment(paymentId, trimmed),
      'Payment rejected. The customer can submit corrected details.',
    );
  }

  if (state.kind === 'loading') return <PageSkeleton />;

  if (state.kind === 'not-found') {
    return (
      <div className="space-y-4">
        <EmptyState title="Payment not found" message="This payment does not exist." />
        <div className="text-center">
          <Link href={LIST_PATH} className="font-medium text-indigo-600 hover:text-indigo-700">
            Back to payments
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load this payment"
          message="Please check your connection and try again."
        />
        <div className="text-center">
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { payment } = state;
  const order = payment.order;
  const pending = payment.status === 'PENDING';

  return (
    <div className="space-y-6">
      <div>
        <Link href={LIST_PATH} className="text-sm text-slate-600 hover:text-indigo-600">
          &larr; Back to payments
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Order {order.orderNumber}
          </h1>
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Submitted {formatDateTime(payment.submittedAt)}
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

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="payment-heading" className={cardClass}>
          <h2 id="payment-heading" className="text-lg font-semibold text-slate-900">
            Payment details
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Method">{paymentMethodLabel(payment.method)}</DetailRow>
            <DetailRow label="Transaction ID">
              <span className="font-mono font-medium">{payment.transactionId}</span>
            </DetailRow>
            <DetailRow label="Sender phone">{payment.senderPhone ?? 'Not provided'}</DetailRow>
            <DetailRow label="Amount paid to match">
              <span className="font-semibold">{formatPrice(payment.amount)}</span>
            </DetailRow>
            <DetailRow label="Order total">{formatPrice(order.totalAmount)}</DetailRow>
            {payment.reviewedAt ? (
              <DetailRow label="Reviewed">
                {formatDateTime(payment.reviewedAt)}
                {payment.reviewedBy ? ` by ${payment.reviewedBy}` : ''}
              </DetailRow>
            ) : null}
            {payment.rejectionReason ? (
              <DetailRow label="Rejection reason">
                <span className="text-rose-700">{payment.rejectionReason}</span>
              </DetailRow>
            ) : null}
          </dl>
          <p className="mt-4 text-sm">
            {payment.screenshotUrl ? (
              <a
                href={payment.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 underline hover:text-indigo-700"
              >
                Open screenshot (new tab)
              </a>
            ) : (
              <span className="text-slate-500">No screenshot submitted.</span>
            )}
          </p>
        </section>

        <section aria-labelledby="order-heading" className={cardClass}>
          <h2 id="order-heading" className="text-lg font-semibold text-slate-900">
            Order
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Customer">{order.customer.name}</DetailRow>
            <DetailRow label="Account email">{order.customer.email}</DetailRow>
            <DetailRow label="Ship to">{order.shipping.name}</DetailRow>
            <DetailRow label="Phone">{order.shipping.phone}</DetailRow>
            <DetailRow label="Placed">{formatDateTime(order.createdAt)}</DetailRow>
          </dl>
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {order.items.map((item, index) => (
              <li key={`${item.sku}-${index}`} className="flex justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    SKU {item.sku} &middot; Qty {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-medium text-slate-900">
                  {formatPrice(item.totalPrice)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="history-heading" className={cardClass}>
        <h2 id="history-heading" className="text-lg font-semibold text-slate-900">
          Submission history ({payment.attemptCount}{' '}
          {payment.attemptCount === 1 ? 'attempt' : 'attempts'})
        </h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {payment.submissions.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-mono text-slate-900">
                  {entry.transactionId}
                  {entry.id === payment.id ? (
                    <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 font-sans text-xs text-indigo-700">
                      this submission
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{formatDateTime(entry.submittedAt)}</p>
                {entry.rejectionReason ? (
                  <p className="text-xs text-rose-700">Reason: {entry.rejectionReason}</p>
                ) : null}
              </div>
              <PaymentStatusBadge status={entry.status} />
            </li>
          ))}
        </ul>
      </section>

      {pending ? (
        <section aria-labelledby="actions-heading" className={cardClass}>
          <h2 id="actions-heading" className="text-lg font-semibold text-slate-900">
            Decision
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Check the transaction in your {paymentMethodLabel(payment.method)} account first. The
            amount must be {formatPrice(payment.amount)}.
          </p>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              {confirmingApprove ? (
                <div
                  role="alertdialog"
                  aria-label="Confirm approval"
                  className="rounded-lg bg-emerald-50 p-3 text-sm"
                >
                  <p className="text-emerald-900">
                    Approve this payment of {formatPrice(payment.amount)}? The order moves to
                    Processing.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={onApprove}
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? 'Approving...' : 'Yes, approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingApprove(false)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingApprove(true)}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve payment
                </button>
              )}
            </div>

            <form onSubmit={onReject} noValidate>
              <label
                htmlFor="rejectReason"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Reject with a reason (shown to the customer)
              </label>
              <textarea
                id="rejectReason"
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReasonError(null);
                }}
                aria-invalid={reasonError ? true : undefined}
                aria-describedby={reasonError ? 'rejectReason-error' : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                  reasonError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-100'
                }`}
              />
              <div className="mt-1 flex justify-between text-xs">
                {reasonError ? (
                  <p id="rejectReason-error" className="text-rose-600">
                    {reasonError}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-slate-500">
                  {reason.trim().length}/{REASON_MAX}
                </span>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="mt-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Working...' : 'Reject payment'}
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
