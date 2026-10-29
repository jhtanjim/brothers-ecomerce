'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getAdminOrders } from '@/lib/api/admin-orders';
import type {
  AdminOrderFilters,
  AdminOrderListItem,
  OrderStatus,
  PaginationMeta,
  PaymentStatus,
} from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/orders';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;

const STATUS_TABS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_OPTIONS: { value: PaymentStatus | ''; label: string }[] = [
  { value: '', label: 'Any payment' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PENDING', label: 'Under review' },
  { value: 'APPROVED', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminOrderListItem[]; meta: PaginationMeta }
  | { kind: 'error' };

function parseStatus(raw: string | null): OrderStatus | undefined {
  const match = STATUS_TABS.find((tab) => tab.value !== '' && tab.value === raw);
  return match ? (match.value as OrderStatus) : undefined;
}

function parsePayment(raw: string | null): PaymentStatus | undefined {
  const match = PAYMENT_OPTIONS.find((option) => option.value !== '' && option.value === raw);
  return match ? (match.value as PaymentStatus) : undefined;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(filters: AdminOrderFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.paymentStatus) query.set('paymentStatus', filters.paymentStatus);
  if (filters.search) query.set('search', filters.search);
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

export function OrdersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const paymentStatus = parsePayment(searchParams.get('paymentStatus'));
  const search = (searchParams.get('search') ?? '').trim().slice(0, 40) || undefined;
  const page = parsePage(searchParams.get('page'));

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [searchText, setSearchText] = useState(search ?? '');

  useEffect(() => {
    setSearchText(search ?? '');
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminOrders({ status, paymentStatus, search }, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example an old link) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefFor({ status, paymentStatus, search }, meta.totalPages));
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
  }, [status, paymentStatus, search, page, attempt, router]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = searchText.trim().slice(0, 40);
    router.push(hrefFor({ status, paymentStatus, search: text || undefined }, 1));
  }

  const filtered = Boolean(status || paymentStatus || search);

  return (
    <div>
      <nav aria-label="Order status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = (tab.value || undefined) === status;
          return (
            <Link
              key={tab.value || 'all'}
              href={hrefFor({ status: tab.value || undefined, paymentStatus, search }, 1)}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                active
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="orderSearch" className="sr-only">
            Search by order number
          </label>
          <input
            id="orderSearch"
            type="search"
            value={searchText}
            maxLength={40}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Order number"
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </form>

        <label htmlFor="paymentFilter" className="sr-only">
          Payment status
        </label>
        <select
          id="paymentFilter"
          value={paymentStatus ?? ''}
          onChange={(event) =>
            router.push(
              hrefFor({ status, paymentStatus: parsePayment(event.target.value), search }, 1),
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
        >
          {PAYMENT_OPTIONS.map((option) => (
            <option key={option.value || 'any'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {filtered ? (
          <Link
            href={LIST_PATH}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        {state.kind === 'loading' ? <TableSkeleton /> : null}

        {state.kind === 'error' ? (
          <div className="space-y-4">
            <ErrorState
              title="Could not load orders"
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
          <EmptyState
            title="No orders found"
            message={
              filtered ? 'No orders match these filters.' : 'No orders have been placed yet.'
            }
          />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'order' : 'orders'}
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
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Items
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Placed
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Payment
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <span className="sr-only">Manage</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.items.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p>{order.customerName}</p>
                        <p className="text-xs text-slate-500">{order.customerEmail}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {order.itemCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {formatPrice(order.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`${LIST_PATH}/${encodeURIComponent(order.id)}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Manage
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
              hrefFor={(target) => hrefFor({ status, paymentStatus, search }, target)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
