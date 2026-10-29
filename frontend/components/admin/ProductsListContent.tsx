'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getAdminCategories } from '@/lib/api/admin-categories';
import {
  deleteAdminProduct,
  getAdminProducts,
  setAdminProductStatus,
} from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type {
  AdminCategory,
  AdminProduct,
  AdminProductFilters,
  PaginationMeta,
  ProductSort,
  ProductStatus,
} from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const LIST_PATH = '/admin/products';
const PAGE_SIZE = 20;
const MAX_PAGE = 100_000;
const SEARCH_MAX_LENGTH = 100;
const CATEGORY_LIMIT = 100; // API maximum page size

const STATUS_TABS: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ARCHIVED', label: 'Archived' },
];

/** The first option is the backend default, so it is left out of the URL. */
const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'popular', label: 'Best selling' },
  { value: 'discount', label: 'Biggest discount' },
];

const STATUS_BADGE: Record<ProductStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-50 text-emerald-700' },
  INACTIVE: { label: 'Inactive', className: 'bg-slate-100 text-slate-600' },
  ARCHIVED: { label: 'Archived', className: 'bg-amber-50 text-amber-800' },
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AdminProduct[]; meta: PaginationMeta }
  | { kind: 'error' };

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function parseStatus(raw: string | null): ProductStatus | undefined {
  const match = STATUS_TABS.find((tab) => tab.value !== '' && tab.value === raw);
  return match ? (match.value as ProductStatus) : undefined;
}

function parseSort(raw: string | null): ProductSort | undefined {
  return SORT_OPTIONS.slice(1).find((option) => option.value === raw)?.value;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE ? value : 1;
}

function hrefFor(filters: AdminProductFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.categoryId) query.set('categoryId', filters.categoryId);
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

function StockCell({ product }: { product: AdminProduct }) {
  if (product.stockQuantity < 1) {
    return <span className="font-medium text-rose-600">Out of stock</span>;
  }
  const low = product.stockQuantity <= product.lowStockThreshold;
  return (
    <span className={low ? 'font-medium text-amber-700' : 'text-slate-700'}>
      {product.stockQuantity}
      {low ? ' (low)' : ''}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-busy="true">
      <div className="h-14 rounded-lg bg-slate-200" />
      <div className="h-14 rounded-lg bg-slate-200" />
      <div className="h-14 rounded-lg bg-slate-200" />
    </div>
  );
}

export function ProductsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const categoryId = searchParams.get('categoryId')?.trim() || undefined;
  const search = (searchParams.get('search') ?? '').trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
  const sort = parseSort(searchParams.get('sort'));
  const page = parsePage(searchParams.get('page'));
  const filters: AdminProductFilters = { status, categoryId, search, sort };

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [searchText, setSearchText] = useState(search ?? '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setSearchText(search ?? '');
  }, [search]);

  useEffect(() => {
    // The filter still works without the list (the id stays in the URL), so a failure is silent.
    getAdminCategories({}, 1, CATEGORY_LIMIT)
      .then(({ items }) => setCategories(items))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminProducts({ status, categoryId, search, sort }, page, PAGE_SIZE)
      .then(({ items, meta }) => {
        if (cancelled) return;
        // A page past the end (for example after deleting the last row) goes to the last real page.
        if (items.length === 0 && meta.total > 0 && page > meta.totalPages) {
          router.replace(hrefFor({ status, categoryId, search, sort }, meta.totalPages));
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
  }, [status, categoryId, search, sort, page, attempt, router]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = searchText.trim().slice(0, SEARCH_MAX_LENGTH);
    router.push(hrefFor({ ...filters, search: text || undefined }, 1));
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

  function changeStatus(product: AdminProduct, next: ProductStatus, verb: string) {
    void run(product.id, () => setAdminProductStatus(product.id, next), `${product.name} ${verb}.`);
  }

  const filtered = Boolean(status || categoryId || search);
  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Product status" className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const active = (tab.value || undefined) === status;
            return (
              <Link
                key={tab.value || 'all'}
                href={hrefFor({ ...filters, status: tab.value || undefined }, 1)}
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
          New product
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="flex gap-2" role="search">
          <label htmlFor="productSearch" className="sr-only">
            Search by name or SKU
          </label>
          <input
            id="productSearch"
            type="search"
            value={searchText}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Name or SKU"
            className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Search
          </button>
        </form>
        <label htmlFor="productCategory" className="sr-only">
          Filter by category
        </label>
        <select
          id="productCategory"
          value={categoryId ?? ''}
          onChange={(event) =>
            router.push(hrefFor({ ...filters, categoryId: event.target.value || undefined }, 1))
          }
          className={selectClass}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.status === 'INACTIVE' ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
        <label htmlFor="productSort" className="sr-only">
          Sort products
        </label>
        <select
          id="productSort"
          value={sort ?? SORT_OPTIONS[0].value}
          onChange={(event) =>
            router.push(hrefFor({ ...filters, sort: parseSort(event.target.value) }, 1))
          }
          className={selectClass}
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
              title="Could not load products"
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
            title="No products found"
            message={
              filtered ? 'No products match these filters.' : 'No products have been added yet.'
            }
          />
        ) : null}

        {state.kind === 'ready' && state.meta.total > 0 ? (
          <div>
            <p className="mb-2 text-sm text-slate-500" aria-live="polite">
              {state.meta.total} {state.meta.total === 1 ? 'product' : 'products'}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">
                      Sold
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
                  {state.items.map((product) => {
                    const busy = busyId === product.id;
                    const image = product.images[0];
                    const badge = STATUS_BADGE[product.status];
                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                              {image ? (
                                <Image
                                  src={image.url}
                                  alt=""
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900">
                                {product.name}
                                {product.featured ? (
                                  <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                                    Featured
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-xs text-slate-500">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {product.category.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {product.discountPrice ? (
                            <>
                              <p className="font-medium text-slate-900">
                                {formatPrice(product.discountPrice)}
                              </p>
                              <p className="text-xs text-slate-500 line-through">
                                {formatPrice(product.price)}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium text-slate-900">
                              {formatPrice(product.price)}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <StockCell product={product} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                          {product.soldCount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {confirmId === product.id ? (
                            <span className="inline-flex items-center gap-3">
                              <span className="text-slate-700">Delete permanently?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void run(
                                    product.id,
                                    () => deleteAdminProduct(product.id),
                                    `${product.name} deleted.`,
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
                                href={`${LIST_PATH}/${encodeURIComponent(product.id)}/edit`}
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                Edit
                              </Link>
                              {product.status === 'ARCHIVED' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    changeStatus(product, 'INACTIVE', 'restored as inactive')
                                  }
                                  className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
                                >
                                  Restore
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      product.status === 'ACTIVE'
                                        ? changeStatus(product, 'INACTIVE', 'deactivated')
                                        : changeStatus(product, 'ACTIVE', 'activated')
                                    }
                                    className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
                                  >
                                    {product.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => changeStatus(product, 'ARCHIVED', 'archived')}
                                    className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-60"
                                  >
                                    Archive
                                  </button>
                                </>
                              )}
                              {product.soldCount === 0 ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setConfirmId(product.id)}
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
              hrefFor={(target) => hrefFor(filters, target)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
