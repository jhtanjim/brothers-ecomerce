'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getAdminProducts } from '@/lib/api/admin-products';
import { createPosSale } from '@/lib/api/admin-pos';
import { ApiError } from '@/lib/api/client';
import type { AdminProduct, AdminProductVariant, PaymentMethod } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

const RESULT_LIMIT = 12;
const SEARCH_DELAY_MS = 250;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const TRANSACTION_PATTERN = /^[A-Z0-9]{6,30}$/;
const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BKASH', label: 'bKash' },
  { value: 'NAGAD', label: 'Nagad' },
];
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

interface Line {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  option: string;
  sku: string;
  /** Integer cents, so the totals here match the backend's. */
  priceCents: number;
  quantity: number;
  stock: number;
}

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function newSaleKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. The sale was not saved. Try again.';
  return err.message;
}

function lineFrom(product: AdminProduct, variant?: AdminProductVariant): Line {
  return {
    key: `${product.id}:${variant?.id ?? ''}`,
    productId: product.id,
    variantId: variant?.id,
    name: product.name,
    option: variant ? optionLabel(variant.size, variant.color) : '',
    sku: variant?.sku ?? product.sku,
    priceCents: toCents(product.discountPrice ?? product.price),
    quantity: 1,
    stock: variant?.stockQuantity ?? product.stockQuantity,
  };
}

/** One tap per size/colour; a product without options is a single button. */
function ProductResult({ product, onAdd }: { product: AdminProduct; onAdd: (line: Line) => void }) {
  const image = product.images[0]?.url;
  return (
    <li className="flex gap-3 border-t border-slate-100 py-3 first:border-t-0">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-slate-100">
        {image ? <Image src={image} alt="" fill sizes="64px" className="object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{product.name}</p>
        <p className="text-sm text-slate-600">
          {formatPrice(product.discountPrice ?? product.price)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {product.variants.length > 0 ? (
            product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                disabled={variant.stockQuantity < 1}
                onClick={() => onAdd(lineFrom(product, variant))}
                className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:line-through"
              >
                {optionLabel(variant.size, variant.color)}{' '}
                <span className="font-normal text-slate-500">({variant.stockQuantity})</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              disabled={product.stockQuantity < 1}
              onClick={() => onAdd(lineFrom(product))}
              className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              {product.stockQuantity < 1 ? 'Out of stock' : `Add (${product.stockQuantity})`}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function PosContent() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [cash, setCash] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Kept across retries, so a repeated submit can never record the sale twice.
  const saleKey = useRef(newSaleKey());

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      getAdminProducts({ status: 'ACTIVE', search: search.trim() || undefined }, 1, RESULT_LIMIT)
        .then(({ items }) => {
          if (cancelled) return;
          setResults(items);
          setSearchError(false);
        })
        .catch(() => {
          if (!cancelled) setSearchError(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  function add(line: Line) {
    setError(null);
    setLines((current) => {
      const existing = current.find((entry) => entry.key === line.key);
      if (!existing) return [...current, line];
      return current.map((entry) =>
        entry.key === line.key
          ? { ...entry, quantity: Math.min(entry.quantity + 1, entry.stock) }
          : entry,
      );
    });
  }

  function setQuantity(key: string, quantity: number) {
    setLines((current) =>
      current.map((entry) =>
        entry.key === key
          ? { ...entry, quantity: Math.max(1, Math.min(quantity, entry.stock)) }
          : entry,
      ),
    );
  }

  /** A barcode scanner types the SKU and presses Enter: an exact match goes straight in. */
  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = search.trim().toUpperCase();
    if (!code) return;
    try {
      const { items } = await getAdminProducts({ status: 'ACTIVE', search: code }, 1, RESULT_LIMIT);
      for (const product of items) {
        const variant = product.variants.find((entry) => entry.sku.toUpperCase() === code);
        const isProduct = product.sku.toUpperCase() === code && product.variants.length === 0;
        if ((variant && variant.stockQuantity > 0) || (isProduct && product.stockQuantity > 0)) {
          add(lineFrom(product, variant));
          setSearch('');
          searchRef.current?.focus();
          return;
        }
      }
    } catch {
      setSearchError(true);
    }
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0);
  const discountValid = discount === '' || MONEY_PATTERN.test(discount);
  const discountCents = discountValid && discount !== '' ? toCents(discount) : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const isCash = method === 'CASH';
  const cleanTransactionId = transactionId.trim().toUpperCase();
  const transactionValid = TRANSACTION_PATTERN.test(cleanTransactionId);
  const cashValid = MONEY_PATTERN.test(cash);
  const cashCents = cashValid ? toCents(cash) : 0;
  const changeCents = cashCents - totalCents;
  const canComplete =
    lines.length > 0 &&
    discountValid &&
    discountCents <= subtotalCents &&
    (isCash ? cashValid && changeCents >= 0 : transactionValid) &&
    !submitting;

  async function onComplete() {
    if (!canComplete) return;
    setSubmitting(true);
    setError(null);
    try {
      const sale = await createPosSale(
        {
          items: lines.map((line) => ({
            productId: line.productId,
            ...(line.variantId ? { variantId: line.variantId } : {}),
            quantity: line.quantity,
          })),
          paymentMethod: method,
          ...(isCash ? { cashReceived: Number(cash) } : { transactionId: cleanTransactionId }),
          ...(discountCents > 0 ? { discount: Number(discount) } : {}),
          ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
          ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        },
        saleKey.current,
      );
      router.push(`/admin/pos/receipts/${encodeURIComponent(sale.id)}?print=1`);
    } catch (err) {
      // A refused sale (stock, cash) changed nothing, so the corrected one needs a new key.
      if (err instanceof ApiError && err.status !== 0) saleKey.current = newSaleKey();
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
      <section
        aria-labelledby="pos-items-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3"
      >
        <h2 id="pos-items-heading" className="text-lg font-semibold text-slate-900">
          Find items
        </h2>
        <form onSubmit={(event) => void onSearchSubmit(event)} role="search" className="mt-3">
          <label htmlFor="posSearch" className="sr-only">
            Search by name or SKU
          </label>
          <input
            id="posSearch"
            ref={searchRef}
            type="search"
            value={search}
            maxLength={100}
            autoComplete="off"
            placeholder="Type a name or SKU, or scan a barcode"
            onChange={(e) => setSearch(e.target.value)}
            className={INPUT_CLASS}
          />
        </form>
        {searchError ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            Could not load products. Check your connection.
          </p>
        ) : !searching && results.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No products found.</p>
        ) : (
          <ul className="mt-2" aria-busy={searching}>
            {results.map((product) => (
              <ProductResult key={product.id} product={product} onAdd={add} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="pos-sale-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"
      >
        <h2 id="pos-sale-heading" className="text-lg font-semibold text-slate-900">
          Current sale
        </h2>
        {lines.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Add items from the list to start a sale.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {lines.map((line) => (
              <li key={line.key} className="py-3">
                <div className="flex justify-between gap-3 text-sm">
                  <p className="min-w-0 font-medium text-slate-900">
                    {line.name}
                    {line.option ? (
                      <span className="block font-normal text-slate-600">{line.option}</span>
                    ) : null}
                  </p>
                  <p className="shrink-0 font-semibold text-slate-900">
                    {formatPrice(fromCents(line.priceCents * line.quantity))}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Decrease ${line.name}`}
                    disabled={line.quantity <= 1}
                    onClick={() => setQuantity(line.key, line.quantity - 1)}
                    className="h-11 w-11 border border-slate-300 text-lg text-slate-700 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span aria-live="polite" className="w-8 text-center text-sm font-medium">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${line.name}`}
                    disabled={line.quantity >= line.stock}
                    onClick={() => setQuantity(line.key, line.quantity + 1)}
                    className="h-11 w-11 border border-slate-300 text-lg text-slate-700 disabled:opacity-40"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) => current.filter((entry) => entry.key !== line.key))
                    }
                    className="ml-auto min-h-11 px-2 text-sm font-medium text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="mt-4 border-t border-slate-200 pt-4">
          <legend className="float-left mb-2 w-full text-sm font-medium text-slate-700">
            Payment
          </legend>
          <div className="clear-both flex gap-2">
            {PAYMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={method === option.value}
                onClick={() => {
                  setMethod(option.value);
                  setError(null);
                }}
                className={`min-h-11 flex-1 border px-3 text-sm font-semibold ${
                  method === option.value
                    ? 'border-brand-950 bg-brand-950 text-white'
                    : 'border-slate-300 text-slate-800 hover:border-brand-950'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="posName" className="mb-1 block text-sm font-medium text-slate-700">
              Customer name (optional)
            </label>
            <input
              id="posName"
              value={customerName}
              maxLength={100}
              onChange={(e) => setCustomerName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="posPhone" className="mb-1 block text-sm font-medium text-slate-700">
              Phone (optional)
            </label>
            <input
              id="posPhone"
              type="tel"
              value={customerPhone}
              maxLength={16}
              onChange={(e) => setCustomerPhone(e.target.value.trim())}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="posDiscount" className="mb-1 block text-sm font-medium text-slate-700">
              Discount (BDT)
            </label>
            <input
              id="posDiscount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value.trim())}
              className={INPUT_CLASS}
            />
          </div>
          {isCash ? (
            <div>
              <label htmlFor="posCash" className="mb-1 block text-sm font-medium text-slate-700">
                Cash received (BDT)
              </label>
              <input
                id="posCash"
                inputMode="decimal"
                value={cash}
                onChange={(e) => setCash(e.target.value.trim())}
                className={INPUT_CLASS}
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="posTransaction"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Transaction ID
              </label>
              <input
                id="posTransaction"
                value={transactionId}
                maxLength={30}
                autoComplete="off"
                onChange={(e) => setTransactionId(e.target.value)}
                className={`${INPUT_CLASS} uppercase`}
              />
            </div>
          )}
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd>{formatPrice(fromCents(subtotalCents))}</dd>
          </div>
          {discountCents > 0 ? (
            <div className="flex justify-between">
              <dt className="text-slate-600">Discount</dt>
              <dd className="text-rose-600">-{formatPrice(fromCents(discountCents))}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatPrice(fromCents(totalCents))}</dd>
          </div>
          {isCash && cashValid && lines.length > 0 ? (
            <div
              className={`flex justify-between font-semibold ${
                changeCents < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              <dt>{changeCents < 0 ? 'Still owed' : 'Change to give'}</dt>
              <dd>{formatPrice(fromCents(Math.abs(changeCents)))}</dd>
            </div>
          ) : null}
        </dl>

        {!discountValid || discountCents > subtotalCents ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            Enter a discount that is no more than the subtotal.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canComplete}
          onClick={() => void onComplete()}
          className="mt-4 min-h-12 w-full bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Complete sale and print'}
        </button>
      </section>
    </div>
  );
}
