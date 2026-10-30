'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import { ApiError } from '@/lib/api/client';
import type { ProductVariant } from '@/lib/api/types';

/** Keep in sync with MAX_QUANTITY_PER_LINE in the backend (the backend enforces it anyway). */
const MAX_QUANTITY = 20;
const LOW_STOCK_NOTICE_AT = 5;

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function OptionGroup({
  label,
  options,
  selected,
  isAvailable,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  isAvailable: (option: string) => boolean;
  onSelect: (option: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-sm font-medium text-slate-900">
        {label}
        {selected ? <span className="font-normal text-slate-600">: {selected}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const available = isAvailable(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected === option}
              disabled={!available}
              onClick={() => onSelect(option)}
              className={`min-h-11 min-w-11 border px-3 text-sm font-medium ${
                selected === option
                  ? 'border-brand-950 bg-brand-950 text-white'
                  : available
                    ? 'border-slate-300 bg-white text-slate-800 hover:border-brand-950'
                    : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface AddToCartButtonProps {
  productId: string;
  slug: string;
  stockQuantity: number;
  variants: ProductVariant[];
}

export function AddToCartButton({
  productId,
  slug,
  stockQuantity,
  variants,
}: AddToCartButtonProps) {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const sizes = unique(variants.map((variant) => variant.size));
  const colors = unique(variants.map((variant) => variant.color));
  // A single choice is made for the customer.
  const [size, setSize] = useState(sizes.length === 1 ? (sizes[0] ?? '') : '');
  const [color, setColor] = useState(colors.length === 1 ? (colors[0] ?? '') : '');
  const hasOptions = variants.length > 0;
  const variant = hasOptions
    ? (variants.find((entry) => entry.size === size && entry.color === color) ?? null)
    : null;
  const choiceMissing =
    hasOptions && ((sizes.length > 0 && !size) || (colors.length > 0 && !color));

  if (stockQuantity <= 0) {
    return (
      <button
        type="button"
        disabled
        className="mt-4 h-12 w-full cursor-not-allowed bg-slate-200 px-6 text-sm font-semibold text-slate-500"
      >
        Out of stock
      </button>
    );
  }

  const selectedStock = hasOptions ? (variant?.stockQuantity ?? 0) : stockQuantity;
  const max = Math.max(1, Math.min(selectedStock, MAX_QUANTITY));
  const canBuy = !hasOptions || (variant !== null && selectedStock > 0);

  function choose(setter: (value: string) => void, value: string) {
    setter(value);
    setQuantity(1);
    setMessage(null);
  }

  async function onAdd(mode: 'add' | 'buy') {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }
    if (!canBuy) {
      setMessage({
        type: 'error',
        text: choiceMissing
          ? `Please choose ${!size && sizes.length > 0 ? 'a size' : 'a colour'}.`
          : 'This combination is not available.',
      });
      return;
    }
    setBusy(mode);
    setMessage(null);
    try {
      await add(productId, quantity, variant?.id);
      if (mode === 'buy') {
        router.push('/checkout');
        return;
      }
      setMessage({ type: 'success', text: 'Added to cart' });
    } catch (err) {
      setMessage({
        type: 'error',
        text:
          err instanceof ApiError && err.status !== 0
            ? err.message
            : 'Could not add this item right now. Please try again.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4">
      <OptionGroup
        label="Size"
        options={sizes}
        selected={size}
        isAvailable={(option) =>
          variants.some(
            (entry) =>
              entry.size === option && (!color || entry.color === color) && entry.stockQuantity > 0,
          )
        }
        onSelect={(option) => choose(setSize, option)}
      />
      <OptionGroup
        label="Colour"
        options={colors}
        selected={color}
        isAvailable={(option) =>
          variants.some(
            (entry) =>
              entry.color === option && (!size || entry.size === size) && entry.stockQuantity > 0,
          )
        }
        onSelect={(option) => choose(setColor, option)}
      />
      {variant && variant.stockQuantity > 0 && variant.stockQuantity <= LOW_STOCK_NOTICE_AT ? (
        <p className="mb-3 text-sm font-medium text-amber-700">
          Only {variant.stockQuantity} left in this option
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 items-center border border-slate-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-11 w-11 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            -
          </button>
          <span aria-live="polite" className="w-10 text-center text-sm font-medium text-slate-900">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            className="flex h-11 w-11 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => void onAdd('add')}
          disabled={busy !== null || authStatus === 'loading'}
          className="h-12 flex-1 bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:flex-none"
        >
          {busy === 'add' ? 'Adding...' : 'Add to cart'}
        </button>
        <button
          type="button"
          onClick={() => void onAdd('buy')}
          disabled={busy !== null || authStatus === 'loading'}
          className="h-12 w-full border border-slate-900 px-6 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-60 sm:w-auto"
        >
          {busy === 'buy' ? 'Adding...' : 'Buy now'}
        </button>
      </div>

      {message ? (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-sm ${message.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}
        >
          {message.text}
          {message.type === 'success' ? (
            <>
              {' '}
              <Link href="/cart" className="font-medium underline hover:text-emerald-700">
                View cart
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
