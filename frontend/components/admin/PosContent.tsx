'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getAdminProducts } from '@/lib/api/admin-products';
import { getOrderReturn } from '@/lib/api/admin-returns';
import { createPosSale, getPosCustomer } from '@/lib/api/admin-pos';
import type { PosCustomerHistory } from '@/lib/api/admin-pos';
import { ApiError } from '@/lib/api/client';
import type {
  AdminProduct,
  AdminProductVariant,
  OrderReturn,
  PaymentMethod,
} from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

const RESULT_LIMIT = 12;
const SEARCH_DELAY_MS = 250;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const TRANSACTION_PATTERN = /^[A-Z0-9]{6,30}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
/** Round amounts a customer is likely to hand over: the next 100, 500 and 1000 taka. */
const CASH_ROUNDING_CENTS = [10_000, 50_000, 100_000];
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

/** People type amounts the way they read them, such as 7,550. */
function cleanAmount(value: string): string {
  return value.replace(/[,\s]/g, '');
}

function quickCashCents(dueCents: number): number[] {
  const rounded = CASH_ROUNDING_CENTS.map((step) => Math.ceil(dueCents / step) * step);
  return [...new Set(rounded)].filter((cents) => cents > dueCents);
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function CustomerHistory({ history }: { history: PosCustomerHistory }) {
  if (history.purchaseCount === 0) {
    return <p className="text-sm text-slate-500">New customer: no earlier purchases.</p>;
  }
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <p className="font-semibold text-slate-900">
        {history.purchaseCount} earlier purchase{history.purchaseCount === 1 ? '' : 's'},{' '}
        {formatPrice(history.totalSpent)} in total
      </p>
      <ul className="mt-2 space-y-2">
        {history.recent.map((order) => (
          <li key={order.id} className="text-slate-600">
            <span className="flex justify-between gap-3 font-medium text-slate-800">
              <span>
                {formatDay(order.createdAt)} ({order.channel === 'POS' ? 'Shop' : 'Online'})
              </span>
              <span>{formatPrice(order.totalAmount)}</span>
            </span>
            {order.items
              .map((item) => {
                const option = optionLabel(item.size, item.color);
                return `${item.productName}${option ? ` (${option})` : ''} x ${item.quantity}`;
              })
              .join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
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

export function PosContent({ creditId }: { creditId?: string }) {
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
  const [history, setHistory] = useState<PosCustomerHistory | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Kept across retries, so a repeated submit can never record the sale twice.
  const saleKey = useRef(newSaleKey());

  const [credit, setCredit] = useState<OrderReturn | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!creditId) return;
    let cancelled = false;
    getOrderReturn(creditId)
      .then((result) => {
        if (cancelled) return;
        if (result.refundMethod !== null || result.exchangeOrderId !== null) {
          setCreditError(`The credit from ${result.returnNumber} has already been used.`);
        } else {
          setCredit(result);
        }
      })
      .catch(() => {
        if (!cancelled) setCreditError('Could not load the exchange credit.');
      });
    return () => {
      cancelled = true;
    };
  }, [creditId]);

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

  useEffect(() => {
    setHistory(null);
    setHistoryFailed(false);
    if (!PHONE_PATTERN.test(customerPhone)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getPosCustomer(customerPhone)
        .then((result) => {
          if (cancelled) return;
          setHistory(result);
          // Never replaces a name the cashier has typed.
          if (result.name) setCustomerName((current) => current || (result.name ?? ''));
        })
        .catch(() => {
          // The sale can go ahead without the history.
          if (!cancelled) setHistoryFailed(true);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerPhone]);

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
  const creditCents = credit ? toCents(credit.refundAmount) : 0;
  const dueCents = Math.max(0, totalCents - creditCents);
  // Credit covers it all, so nothing is paid by phone; any difference goes back as cash.
  const creditCovers = credit !== null && creditCents >= totalCents;
  const isCash = method === 'CASH' || creditCovers;
  const cleanTransactionId = transactionId.trim().toUpperCase();
  const transactionValid = TRANSACTION_PATTERN.test(cleanTransactionId);
  const cashValid = MONEY_PATTERN.test(cash);
  const cashCents = cashValid ? toCents(cash) : 0;
  const changeCents = cashCents - dueCents;
  const canComplete =
    lines.length > 0 &&
    discountValid &&
    discountCents <= subtotalCents &&
    (isCash
      ? (cashValid || cash === '') && (cash === '' ? dueCents === 0 : changeCents >= 0)
      : transactionValid) &&
    !submitting;
  // Says what is missing, so a greyed-out button is never a mystery.
  const blockedReason =
    lines.length === 0
      ? 'Add an item to start the sale.'
      : !discountValid || discountCents > subtotalCents
        ? null
        : !isCash
          ? transactionValid
            ? null
            : 'Enter the transaction ID (6 to 30 letters or numbers).'
          : cash !== '' && !cashValid
            ? 'Enter the cash received as a number, such as 7550.'
            : cash === '' && dueCents > 0
              ? 'Enter the cash received.'
              : cash !== '' && changeCents < 0
                ? 'The cash received is less than the amount to pay.'
                : null;

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
          paymentMethod: isCash ? 'CASH' : method,
          ...(isCash ? { cashReceived: Number(cash || 0) } : { transactionId: cleanTransactionId }),
          ...(credit ? { exchangeReturnId: credit.id } : {}),
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
        {creditError ? (
          <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {creditError}
          </p>
        ) : null}
        {credit ? (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Exchange: {formatPrice(credit.refundAmount)} credit from {credit.returnNumber}. Add the
            new items.
          </p>
        ) : null}
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

        {creditCovers ? null : (
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
        )}

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
          {history || historyFailed ? (
            <div aria-live="polite" className="sm:col-span-2">
              {history ? (
                <CustomerHistory history={history} />
              ) : (
                <p className="text-sm text-slate-500">Could not load the customer history.</p>
              )}
            </div>
          ) : null}
          <div>
            <label htmlFor="posDiscount" className="mb-1 block text-sm font-medium text-slate-700">
              Discount (BDT)
            </label>
            <input
              id="posDiscount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(cleanAmount(e.target.value))}
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
                onChange={(e) => setCash(cleanAmount(e.target.value))}
                className={INPUT_CLASS}
              />
              {lines.length > 0 && dueCents > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[dueCents, ...quickCashCents(dueCents)].map((cents) => (
                    <button
                      key={cents}
                      type="button"
                      onClick={() => setCash(fromCents(cents))}
                      className="min-h-11 border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:border-brand-950"
                    >
                      {cents === dueCents ? 'Exact' : formatPrice(fromCents(cents))}
                    </button>
                  ))}
                </div>
              ) : null}
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
          {credit ? (
            <>
              <div className="flex justify-between">
                <dt className="text-slate-600">Exchange credit</dt>
                <dd className="text-emerald-700">-{formatPrice(credit.refundAmount)}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt>To pay</dt>
                <dd>{formatPrice(fromCents(dueCents))}</dd>
              </div>
              {creditCents > totalCents && lines.length > 0 ? (
                <div className="flex justify-between font-semibold text-emerald-700">
                  <dt>Give back from credit</dt>
                  <dd>{formatPrice(fromCents(creditCents - totalCents))}</dd>
                </div>
              ) : null}
            </>
          ) : null}
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
        {blockedReason ? <p className="mt-3 text-sm text-slate-600">{blockedReason}</p> : null}

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
