'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  addAdminProductVariant,
  deleteAdminProductVariant,
  updateAdminProductVariant,
} from '@/lib/api/admin-products';
import { ApiError } from '@/lib/api/client';
import type { AdminProduct, AdminProductVariant } from '@/lib/api/types';

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;
const MAX_STOCK = 1_000_000;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

interface Notice {
  kind: 'ok' | 'error';
  text: string;
}

function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  return err.message;
}

function stockProblem(text: string): string | null {
  const stock = Number(text);
  return text !== '' && Number.isInteger(stock) && stock >= 0 && stock <= MAX_STOCK
    ? null
    : 'Enter stock as a whole number from 0 to 1,000,000.';
}

/** A suggested SKU such as SHIRT-1-M-BLUE. The admin can change it. */
function suggestSku(productSku: string, size: string, color: string): string {
  return [productSku, size, color]
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-');
}

function VariantRow({
  variant,
  busy,
  onSave,
  onDelete,
}: {
  variant: AdminProductVariant;
  busy: boolean;
  onSave: (variant: AdminProductVariant, stock: string) => void;
  onDelete: (variant: AdminProductVariant) => void;
}) {
  const [stock, setStock] = useState(String(variant.stockQuantity));
  const [confirming, setConfirming] = useState(false);
  const changed = stock !== String(variant.stockQuantity);

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 text-slate-900">{variant.size || '-'}</td>
      <td className="px-3 py-2 text-slate-900">{variant.color || '-'}</td>
      <td className="px-3 py-2 font-mono text-xs text-slate-600">{variant.sku}</td>
      <td className="px-3 py-2">
        <label htmlFor={`stock-${variant.id}`} className="sr-only">
          Stock for {variant.sku}
        </label>
        <input
          id={`stock-${variant.id}`}
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value.trim())}
          className={`${INPUT_CLASS} w-24`}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {confirming ? (
          <>
            <span className="text-xs text-slate-700">Delete?</span>{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(variant)}
              className="px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !changed}
              onClick={() => onSave(variant, stock)}
              className="px-2 py-1 text-xs font-medium text-brand-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

/**
 * Sizes and colours with their own stock. Once a product has options, its total stock is the sum
 * of them and customers must choose one.
 */
export function ProductVariantsManager({
  product,
  onChange,
}: {
  product: AdminProduct;
  onChange: (product: AdminProduct) => void;
}) {
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('0');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const variants = product.variants;

  async function run(action: () => Promise<AdminProduct>, successText: string): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      onChange(await action());
      setNotice({ kind: 'ok', text: successText });
      return true;
    } catch (err) {
      setNotice({ kind: 'error', text: describeError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleanSize = size.trim();
    const cleanColor = color.trim();
    const cleanSku = (sku.trim() || suggestSku(product.sku, cleanSize, cleanColor)).toUpperCase();
    const problem =
      !cleanSize && !cleanColor ? 'Enter a size, a colour or both.' : stockProblem(stock);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    if (cleanSku.length < 2 || cleanSku.length > 64 || !SKU_PATTERN.test(cleanSku)) {
      setNotice({
        kind: 'error',
        text: 'Use 2 to 64 letters, numbers, dots, underscores or hyphens for the SKU.',
      });
      return;
    }
    const added = await run(
      () =>
        addAdminProductVariant(product.id, {
          ...(cleanSize ? { size: cleanSize } : {}),
          ...(cleanColor ? { color: cleanColor } : {}),
          sku: cleanSku,
          stockQuantity: Number(stock),
        }),
      'Option added.',
    );
    if (added) {
      setSize('');
      setSku('');
      setStock('0');
    }
  }

  function onSave(variant: AdminProductVariant, nextStock: string) {
    const problem = stockProblem(nextStock);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    void run(
      () => updateAdminProductVariant(product.id, variant.id, { stockQuantity: Number(nextStock) }),
      'Stock saved.',
    );
  }

  function onDelete(variant: AdminProductVariant) {
    void run(() => deleteAdminProductVariant(product.id, variant.id), 'Option deleted.');
  }

  return (
    <section
      aria-labelledby="variantsHeading"
      className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div>
        <h2 id="variantsHeading" className="text-base font-semibold text-slate-900">
          Sizes and colours
        </h2>
        <p className="text-sm text-slate-500">
          {variants.length > 0
            ? `Total stock: ${product.stockQuantity}, the sum of the options below.`
            : 'Optional. Adding the first option replaces the stock number below with the stock of the options.'}
        </p>
      </div>

      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {variants.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Colour</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <VariantRow
                  // Remount after a save, so the field always shows the stored number.
                  key={`${variant.id}-${variant.stockQuantity}`}
                  variant={variant}
                  busy={busy}
                  onSave={onSave}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form onSubmit={onAdd} noValidate className="grid gap-3 sm:grid-cols-5 sm:items-end">
        <div>
          <label htmlFor="variantSize" className="mb-1 block text-sm font-medium text-slate-700">
            Size
          </label>
          <input
            id="variantSize"
            value={size}
            maxLength={20}
            placeholder="M"
            onChange={(e) => setSize(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="variantColor" className="mb-1 block text-sm font-medium text-slate-700">
            Colour
          </label>
          <input
            id="variantColor"
            value={color}
            maxLength={40}
            placeholder="Navy"
            onChange={(e) => setColor(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="variantSku" className="mb-1 block text-sm font-medium text-slate-700">
            SKU
          </label>
          <input
            id="variantSku"
            value={sku}
            maxLength={64}
            placeholder="Automatic"
            onChange={(e) => setSku(e.target.value)}
            className={`${INPUT_CLASS} uppercase placeholder:normal-case`}
          />
        </div>
        <div>
          <label htmlFor="variantStock" className="mb-1 block text-sm font-medium text-slate-700">
            Stock
          </label>
          <input
            id="variantStock"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add option
        </button>
      </form>
    </section>
  );
}
