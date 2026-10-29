'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getAdminCustomers, setAdminCustomerStatus } from '@/lib/api/admin-customers';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCustomer,
  AdminCustomerFilters,
  CustomerStatus,
  PaginationMeta,
} from '@/lib/api/types';
import { formatDateTime } from '@/lib/format-date';

const LIST_PATH = '/admin/customers';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const SEARCH_MAX_LENGTH = 100;

const STATUS_TABS: { value: CustomerStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminCustomer[]; meta: PaginationMeta }
  | { kind: 'error' };

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function parseStatus(raw: string | null): CustomerStatus | undefined {
  const match = STATUS_TABS.find((tab) => tab.value !== '' && tab.value === raw);
  return match ? (match.value as CustomerStatus) : undefined;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(filters: AdminCustomerFilters, page: number): string {
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

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true">
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
      <div className="h-12 rounded-lg bg-slate-200" />
    </div>
  );
}

export function CustomersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const search = (searchParams.get('search') ?? '').trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
  const page = parsePage(searchParams.get('page'));

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [searchText, setSearchText] = useState(search ?? '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setSearchText(search ?? '');
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminCustomers({ status, search }, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
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
    const text = searchText.trim().slice(0, SEARCH_MAX_LENGTH);
    router.push(hrefFor({ status, search: text || undefined }, 1));
  }

  async function changeStatus(customer: AdminCustomer, next: CustomerStatus) {
    setBusyId(customer.id);
    setNotice(null);
    try {
      await setAdminCustomerStatus(customer.id, next, reason.trim() || undefined);
      setNotice({
        kind: 'ok',
        text:
          next === 'SUSPENDED'
            ? `${customer.name} is suspended and has been signed out everywhere.`
            : `${customer.name} can sign in again.`,
      });
      setAttempt((count) => count + 1);
    } catch (err) {
      setNotice({ kind: 'error', text: describeError(err) });
    } finally {
      setBusyId(null);
      setConfirmId(null);
      setReason('');
    }
  }

  const filtered = Boolean(status || search);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Customer status" className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const active = (tab.value || undefined) === status;
            return (
              <Link
                key={tab.value || 'all'}
                href={hrefFor({ status: tab.value || undefined, search }, 1)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="customerSearch" className="sr-only">
            Search by name, email or phone
          </label>
          <input
            id="customerSearch"
            type="search"
            value={searchText}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Name, email or phone"
            className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </form>
        {filtered ? (
          <Link
            href={LIST_PATH}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
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
              title="Could not load customers"
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
        ) : null}

        {state.kind === 'ready' && state.meta.total === 0 ? (
          <EmptyState
            title="No customers found"
            message={filtered ? 'No customers match these filters.' : 'No one has signed up yet.'}
          />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'customer' : 'customers'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Phone
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Orders
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Last order
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Joined
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
                  {state.items.map((customer) => {
                    const busy = busyId === customer.id;
                    const suspended = customer.status === 'SUSPENDED';
                    return (
                      <tr key={customer.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{customer.name}</p>
                          <p className="text-xs text-slate-500">{customer.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {customer.phone ?? '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {customer.orderCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : 'Never'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(customer.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              suspended
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {confirmId === customer.id ? (
                            <div className="ml-auto w-64 space-y-2 text-left">
                              <p className="text-sm font-medium text-slate-900">
                                Suspend {customer.name}?
                              </p>
                              <p className="text-xs text-slate-600">
                                They are signed out everywhere and cannot sign in until reactivated.
                                Existing orders are not changed.
                              </p>
                              <label htmlFor={`reason-${customer.id}`} className="sr-only">
                                Reason (optional)
                              </label>
                              <input
                                id={`reason-${customer.id}`}
                                value={reason}
                                maxLength={500}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="Reason (optional, kept in the log)"
                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                              />
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void changeStatus(customer, 'SUSPENDED')}
                                  className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                                >
                                  {busy ? 'Suspending...' : 'Yes, suspend'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setConfirmId(null);
                                    setReason('');
                                  }}
                                  className="font-medium text-slate-600 hover:text-slate-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : suspended ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void changeStatus(customer, 'ACTIVE')}
                              className="whitespace-nowrap font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
                            >
                              {busy ? 'Reactivating...' : 'Reactivate'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setReason('');
                                setConfirmId(customer.id);
                              }}
                              className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
                            >
                              Suspend
                            </button>
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
