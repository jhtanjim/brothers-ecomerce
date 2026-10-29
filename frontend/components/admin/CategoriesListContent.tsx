'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import {
  deleteAdminCategory,
  getAdminCategories,
  setAdminCategoryStatus,
} from '@/lib/api/admin-categories';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCategory,
  AdminCategoryFilters,
  AdminCategorySort,
  CategoryStatus,
  PaginationMeta,
} from '@/lib/api/types';

const LIST_PATH = '/admin/categories';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const SEARCH_MAX_LENGTH = 100;

const STATUS_TABS: { value: CategoryStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

/** The first option is the backend default, so it is left out of the URL. */
const SORT_OPTIONS: { value: AdminCategorySort; label: string }[] = [
  { value: 'sort_order', label: 'Sort order' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'newest', label: 'Newest' },
];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminCategory[]; meta: PaginationMeta }
  | { kind: 'error' };

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function parseStatus(raw: string | null): CategoryStatus | undefined {
  const match = STATUS_TABS.find((tab) => tab.value !== '' && tab.value === raw);
  return match ? (match.value as CategoryStatus) : undefined;
}

function parseSort(raw: string | null): AdminCategorySort | undefined {
  const match = SORT_OPTIONS.slice(1).find((option) => option.value === raw);
  return match?.value;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(filters: AdminCategoryFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.sort) query.set('sort', filters.sort);
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

export function CategoriesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const search = (searchParams.get('search') ?? '').trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
  const sort = parseSort(searchParams.get('sort'));
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
    getAdminCategories({ status, search, sort }, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example after deleting the last row) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefFor({ status, search, sort }, meta.totalPages));
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
  }, [status, search, sort, page, attempt, router]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = searchText.trim().slice(0, SEARCH_MAX_LENGTH);
    router.push(hrefFor({ status, search: text || undefined, sort }, 1));
  }

  function onSortChange(value: string) {
    router.push(hrefFor({ status, search, sort: parseSort(value) }, 1));
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
        <nav aria-label="Category status" className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const active = (tab.value || undefined) === status;
            return (
              <Link
                key={tab.value || 'all'}
                href={hrefFor({ status: tab.value || undefined, search, sort }, 1)}
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
        <Link
          href={`${LIST_PATH}/new`}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          New category
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="categorySearch" className="sr-only">
            Search by name or slug
          </label>
          <input
            id="categorySearch"
            type="search"
            value={searchText}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Name or slug"
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </form>
        <label htmlFor="categorySort" className="sr-only">
          Sort categories
        </label>
        <select
          id="categorySort"
          value={sort ?? SORT_OPTIONS[0].value}
          onChange={(event) => onSortChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {filtered ? (
          <Link
            href={hrefFor({ sort }, 1)}
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
              title="Could not load categories"
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
            title="No categories found"
            message={
              filtered
                ? 'No categories match these filters.'
                : 'No categories have been created yet.'
            }
          />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'category' : 'categories'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Slug
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Products
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Sort order
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
                  {state.items.map((category) => {
                    const busy = busyId === category.id;
                    const next: CategoryStatus =
                      category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                    const deletable = category.productCount === 0;
                    return (
                      <tr key={category.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{category.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {category.slug}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {category.productCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {category.sortOrder}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              category.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {category.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {confirmId === category.id ? (
                            <span className="inline-flex items-center gap-3">
                              <span className="text-slate-700">Delete this category?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    category.id,
                                    () => deleteAdminCategory(category.id),
                                    `Category ${category.name} deleted.`,
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
                                href={`${LIST_PATH}/${encodeURIComponent(category.id)}/edit`}
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    category.id,
                                    () => setAdminCategoryStatus(category.id, next),
                                    `Category ${category.name} ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`,
                                  )
                                }
                                className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
                              >
                                {category.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                disabled={busy || !deletable}
                                title={
                                  deletable
                                    ? undefined
                                    : 'Categories with products cannot be deleted. Deactivate it instead.'
                                }
                                onClick={() => setConfirmId(category.id)}
                                className="font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
                              >
                                Delete
                              </button>
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
              hrefFor={(target) => hrefFor({ status, search, sort }, target)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
