'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { deleteAdminCoupon, getAdminCoupons, setAdminCouponStatus } from '@/lib/api/admin-coupons';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCoupon,
  AdminCouponFilters,
  CouponStatus,
  PaginationMeta,
} from '@/lib/api/types';
import { formatPrice } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/coupons';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;

const STATUS_TABS: { value: CouponStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminCoupon[]; meta: PaginationMeta }
  | { kind: 'error' };

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function parseStatus(raw: string | null): CouponStatus | undefined {
  const match = STATUS_TABS.find((tab) => tab.value !== '' && tab.value === raw);
  return match ? (match.value as CouponStatus) : undefined;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(filters: AdminCouponFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (page > 1) query.set('page', String(page));
  const text = query.toString();
  return text ? `${LIST_PATH}?${text}` : LIST_PATH;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err.message;
}

function discountLabel(coupon: AdminCoupon): string {
  return coupon.type === 'PERCENTAGE' ? `${parseFloat(coupon.value)}%` : formatPrice(coupon.value);
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

export function CouponsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const search = (searchParams.get('search') ?? '').trim().slice(0, 50) || undefined;
  const page = parsePage(searchParams.get('page'));

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [searchText, setSearchText] = useState(search ?? '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setSearchText(search ?? '');
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminCoupons({ status, search }, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example after deleting the last row) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefFor({ status, search }, meta.totalPages));
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
  }, [status, search, page, attempt, router]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = searchText.trim().slice(0, 50);
    router.push(hrefFor({ status, search: text || undefined }, 1));
  }

  async function run(id: string, action: () => Promise<unknown>, successText: string) {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: 'ok', text: successText });
      setAttempt((count) => count + 1);
    } catch (err) {
      setNotice({ kind: 'error', text: describeError(err) });
    } finally {
      setConfirmId(null);
      setBusyId(null);
    }
  }

  const filtered = Boolean(status || search);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Coupon status" className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const active = (tab.value || undefined) === status;
            return (
              <Link
                key={tab.value || 'all'}
                href={hrefFor({ status: tab.value || undefined, search }, 1)}
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
        <Link
          href={`${LIST_PATH}/new`}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New coupon
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="couponSearch" className="sr-only">
            Search by code
          </label>
          <input
            id="couponSearch"
            type="search"
            value={searchText}
            maxLength={50}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Coupon code"
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
        {filtered ? (
          <Link
            href={LIST_PATH}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="mt-4">
        {state.kind === 'loading' ? <TableSkeleton /> : null}

        {state.kind === 'error' ? (
          <div className="space-y-4">
            <ErrorState
              title="Could not load coupons"
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
            title="No coupons found"
            message={
              filtered ? 'No coupons match these filters.' : 'No coupons have been created yet.'
            }
          />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'coupon' : 'coupons'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Discount
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Used
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Expires
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.items.map((coupon) => {
                    const busy = busyId === coupon.id;
                    const next: CouponStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                    return (
                      <tr key={coupon.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {coupon.code}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <p>{discountLabel(coupon)}</p>
                          {coupon.minimumOrderAmount ? (
                            <p className="text-xs text-slate-500">
                              Min order {formatPrice(coupon.minimumOrderAmount)}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {coupon.usedCount}
                          {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {coupon.expiresAt ? formatDateTime(coupon.expiresAt) : 'No expiry'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              coupon.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {coupon.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {confirmId === coupon.id ? (
                            <span className="inline-flex items-center gap-3">
                              <span className="text-slate-700">Delete this coupon?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    coupon.id,
                                    () => deleteAdminCoupon(coupon.id),
                                    `Coupon ${coupon.code} deleted.`,
                                  )
                                }
                                className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                              >
                                {busy ? 'Deleting...' : 'Yes, delete'}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmId(null)}
                                className="font-medium text-slate-600 hover:text-slate-800"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-4">
                              <Link
                                href={`${LIST_PATH}/${encodeURIComponent(coupon.id)}/edit`}
                                className="font-medium text-indigo-600 hover:text-indigo-700"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    coupon.id,
                                    () => setAdminCouponStatus(coupon.id, next),
                                    `Coupon ${coupon.code} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`,
                                  )
                                }
                                className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
                              >
                                {coupon.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>
                              {coupon.usedCount === 0 ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setConfirmId(coupon.id)}
                                  className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={state.meta.page}
              totalPages={state.meta.totalPages}
              hrefFor={(target) => hrefFor({ status, search }, target)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
