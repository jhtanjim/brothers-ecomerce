'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PaymentStatusBadge, paymentMethodLabel } from '@/components/order/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getAdminPayments } from '@/lib/api/admin-payments';
import type { AdminPaymentFilter, AdminPaymentListItem, PaginationMeta } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/payments';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;

const FILTERS: { value: AdminPaymentFilter; label: string; empty: string }[] = [
  {
    value: 'PENDING',
    label: 'Pending',
    empty: 'No pending payments. Everything has been reviewed.',
  },
  { value: 'APPROVED', label: 'Approved', empty: 'No approved payments yet.' },
  { value: 'REJECTED', label: 'Rejected', empty: 'No rejected payments.' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminPaymentListItem[]; meta: PaginationMeta }
  | { kind: 'error' };

function parseStatus(raw: string | null): AdminPaymentFilter {
  return FILTERS.some((filter) => filter.value === raw) ? (raw as AdminPaymentFilter) : 'PENDING';
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(status: AdminPaymentFilter, page: number): string {
  const query = new URLSearchParams();
  if (status !== 'PENDING') query.set('status', status);
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return text ? `${LIST_PATH}?${text}` : LIST_PATH;
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true">
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
    </div>
  );
}

export function PaymentsQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const page = parsePage(searchParams.get('page'));
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminPayments(status, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example an old link) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefFor(status, meta.totalPages));
          return;
        }
        setState({ kind: 'ready', items, meta });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [status, page, attempt, router]);

  const emptyText = FILTERS.find((filter) => filter.value === status)?.empty ?? '';

  return (
    <div>
      <nav aria-label="Payment status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={hrefFor(filter.value, 1)}
            aria-current={filter.value === status ? 'page' : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              filter.value === status
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {state.kind === 'loading' ? <TableSkeleton /> : null}

        {state.kind === 'error' ? (
          <div className="space-y-4">
            <ErrorState
              title="Could not load payments"
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
        ) : null}

        {state.kind === 'ready' && state.meta.total === 0 ? (
          <EmptyState title="Nothing here" message={emptyText} />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'payment' : 'payments'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Method
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Transaction ID
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Submitted
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <span className="sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.items.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {payment.order.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p>{payment.order.customerName}</p>
                        <p className="text-xs text-slate-500">{payment.order.customerPhone}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {paymentMethodLabel(payment.method)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-900">
                        {payment.transactionId}
                        {payment.hasScreenshot ? (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-sans text-xs text-slate-600">
                            screenshot
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {formatPrice(payment.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(payment.submittedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`${LIST_PATH}/${encodeURIComponent(payment.id)}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {payment.status === 'PENDING' ? 'Review' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={state.meta.page}
              totalPages={state.meta.totalPages}
              hrefFor={(target) => hrefFor(status, target)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
