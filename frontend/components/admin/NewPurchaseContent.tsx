'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPurchase } from '@/lib/api/admin-purchases';
import { getAdminProducts } from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type { AdminProduct } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

const RESULT_LIMIT = 12;
const SEARCH_DELAY_MS = 250;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

interface Line {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  option: string;
  quantity: string;
  unitCost: string;
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pur-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function costText(value: string | null): string {
  return value === null ? '' : String(Number(value));
}

function validQuantity(text: string): boolean {
  const value = Number(text);
  return text !== '' && Number.isInteger(value) && value >= 1 && value <= 1_000_000;
}

export function NewPurchaseContent() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminProduct[]>([]);
  const [searchFailed, setSearchFailed] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kept across retries, so a repeated submit can never add the stock twice.
  const key = useRef(newKey());

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getAdminProducts({ search: search.trim() || undefined }, 1, RESULT_LIMIT)
        .then(({ items }) => {
          if (cancelled) return;
          setResults(items.filter((product) => product.status !== 'ARCHIVED'));
          setSearchFailed(false);
        })
        .catch(() => {
          if (!cancelled) setSearchFailed(true);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  function add(line: Omit<Line, 'quantity'>) {
    setLines((current) =>
      current.some((entry) => entry.key === line.key)
        ? current
        : [...current, { ...line, quantity: '1' }],
    );
  }

  function change(key: string, field: 'quantity' | 'unitCost', value: string) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value.trim() } : line)),
    );
  }

  const linesValid =
    lines.length > 0 &&
    lines.every((line) => validQuantity(line.quantity) && MONEY_PATTERN.test(line.unitCost));
  const canSave = linesValid && supplier.trim().length >= 2 && !busy;
  const totalCents = lines.reduce(
    (sum, line) =>
      validQuantity(line.quantity) && MONEY_PATTERN.test(line.unitCost)
        ? sum + Math.round(Number(line.unitCost) * 100) * Number(line.quantity)
        : sum,
    0,
  );

  async function onSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await createPurchase(
        {
          supplierName: supplier.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          items: lines.map((line) => ({
            productId: line.productId,
            ...(line.variantId ? { variantId: line.variantId } : {}),
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          })),
        },
        key.current,
      );
      router.push('/admin/purchases?saved=1');
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

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Find items</h2>
        <label htmlFor="purchaseSearch" className="sr-only">
          Search by name or SKU
        </label>
        <input
          id="purchaseSearch"
          type="search"
          value={search}
          maxLength={100}
          placeholder="Search by name or SKU"
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT_CLASS} mt-3`}
        />
        {searchFailed ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            Could not load products. Check your connection.
          </p>
        ) : null}
        <ul className="mt-2 divide-y divide-slate-100">
          {results.map((product) => (
            <li key={product.id} className="py-3">
              <p className="text-sm font-medium text-slate-900">{product.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.length > 0 ? (
                  product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() =>
                        add({
                          key: `${product.id}:${variant.id}`,
                          productId: product.id,
                          variantId: variant.id,
                          name: product.name,
                          option: optionLabel(variant.size, variant.color),
                          unitCost: costText(product.costPrice),
                        })
                      }
                      className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950"
                    >
                      {optionLabel(variant.size, variant.color)}{' '}
                      <span className="font-normal text-slate-500">({variant.stockQuantity})</span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      add({
                        key: product.id,
                        productId: product.id,
                        name: product.name,
                        option: '',
                        unitCost: costText(product.costPrice),
                      })
                    }
                    className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950"
                  >
                    Add{' '}
                    <span className="font-normal text-slate-500">({product.stockQuantity})</span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">This purchase</h2>
        <div>
          <label htmlFor="supplier" className="mb-1 block text-sm font-medium text-slate-700">
            Supplier
          </label>
          <input
            id="supplier"
            value={supplier}
            maxLength={120}
            onChange={(e) => setSupplier(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">Add the items that arrived.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lines.map((line) => (
              <li key={line.key} className="py-3">
                <div className="flex justify-between gap-3 text-sm">
                  <p className="min-w-0 font-medium text-slate-900">
                    {line.name}
                    {line.option ? (
                      <span className="block font-normal text-slate-600">{line.option}</span>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) => current.filter((entry) => entry.key !== line.key))
                    }
                    className="min-h-11 shrink-0 px-2 font-medium text-rose-600"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={`qty-${line.key}`}
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Quantity
                    </label>
                    <input
                      id={`qty-${line.key}`}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => change(line.key, 'quantity', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`cost-${line.key}`}
                      className="mb-1 block text-xs font-medium text-slate-600"
                    >
                      Buying price each (BDT)
                    </label>
                    <input
                      id={`cost-${line.key}`}
                      inputMode="decimal"
                      value={line.unitCost}
                      onChange={(e) => change(line.key, 'unitCost', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label htmlFor="purchaseNote" className="mb-1 block text-sm font-medium text-slate-700">
            Note (optional)
          </label>
          <input
            id="purchaseNote"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <p className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
          <span>Total cost</span>
          <span>{formatPrice((totalCents / 100).toFixed(2))}</span>
        </p>

        <p className="text-xs text-slate-500">
          Saving adds these units to stock straight away. Check the numbers first: a purchase cannot
          be edited afterwards.
        </p>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void onSave()}
            className="min-h-12 flex-1 bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save and add to stock'}
          </button>
          <Link href="/admin/purchases" className="text-sm font-medium text-slate-600">
            Cancel
          </Link>
        </div>
      </section>
    </div>
  );
}
