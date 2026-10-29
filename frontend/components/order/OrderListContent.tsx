'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/order/StatusBadges';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getOrders } from '@/lib/api/orders';
import type { OrderListItem, PaginationMeta } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/account/orders';
const PAGE_SIZE = 10;
const MAX_PAGE = 100_000;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: OrderListItem[]; meta: PaginationMeta }
  | { kind: 'error' };

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefForPage(page: number): string {
  return page <= 1 ? LIST_PATH : `${LIST_PATH}?page=${page}`;
}

function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="h-28 rounded-xl bg-slate-100" />
    </div>
  );
}

function OrderCard({ order }: { order: OrderListItem }) {
  const first = order.previewItems[0];
  const extra = order.lineCount - 1;

  return (
    <li>
      <Link
        href={`${LIST_PATH}/${encodeURIComponent(order.id)}`}
        className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <p className="font-semibold text-slate-900">Order {order.orderNumber}</p>
            <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
          </div>
          <p className="text-base font-bold text-slate-900">{formatPrice(order.totalAmount)}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2">
            {order.previewItems.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-white bg-slate-100"
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill sizes="48px" className="object-cover" />
                ) : null}
              </div>
            ))}
          </div>
          {first ? (
            <p className="min-w-0 text-sm text-slate-600">
              <span className="line-clamp-1 font-medium text-slate-800">
                {first.quantity} x {first.name}
              </span>
              {extra > 0 ? (
                <span className="text-xs text-slate-500">
                  + {extra} more {extra === 1 ? 'item' : 'items'}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function OrderListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const { status: authStatus } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Signed-out visitors go to login and come straight back to this page (and page number).
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(hrefForPage(page))}`);
    }
  }, [authStatus, page, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    setState({ kind: 'loading' });
    getOrders(page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example an old link) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefForPage(meta.totalPages));
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
  }, [authStatus, page, attempt, router]);

  if (authStatus !== 'authenticated' || state.kind === 'loading') {
    return <ListSkeleton />;
  }

  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState title="Could not load your orders" message="Please check your connection and try again." />
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

  if (state.meta.total === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="No orders yet" message="When you place an order, it will appear here." />
        <div className="text-center">
          <Link
            href="/products"
            className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500" aria-live="polite">
        {state.meta.total} {state.meta.total === 1 ? 'order' : 'orders'}
      </p>
      <ul className="mt-4 space-y-4">
        {state.items.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </ul>
      <Pagination page={state.meta.page} totalPages={state.meta.totalPages} hrefFor={hrefForPage} />
    </div>
  );
}