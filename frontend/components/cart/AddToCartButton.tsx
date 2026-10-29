'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import { ApiError } from '@/lib/api/client';

/** Keep in sync with MAX_QUANTITY_PER_LINE in the backend (the backend enforces it anyway). */
const MAX_QUANTITY = 20;

interface AddToCartButtonProps {
  productId: string;
  slug: string;
  stockQuantity: number;
}

export function AddToCartButton({ productId, slug, stockQuantity }: AddToCartButtonProps) {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (stockQuantity <= 0) {
    return (
      <button
        type="button"
        disabled
        className="mt-6 w-full cursor-not-allowed rounded-lg bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500 sm:w-auto"
      >
        Out of stock
      </button>
    );
  }

  const max = Math.min(stockQuantity, MAX_QUANTITY);

  async function onAdd() {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await add(productId, quantity);
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
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-slate-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="px-3 py-2 text-lg text-slate-700 hover:text-indigo-600 disabled:opacity-40"
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
            className="px-3 py-2 text-lg text-slate-700 hover:text-indigo-600 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={busy || authStatus === 'loading'}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Adding...' : 'Add to cart'}
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