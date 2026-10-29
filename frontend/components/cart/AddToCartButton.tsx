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
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (stockQuantity <= 0) {
    return (
      <button
        type="button"
        disabled
        className="mt-4 h-12 w-full cursor-not-allowed rounded-full bg-slate-200 px-6 text-sm font-semibold text-slate-500"
      >
        Out of stock
      </button>
    );
  }

  const max = Math.min(stockQuantity, MAX_QUANTITY);

  async function onAdd(mode: 'add' | 'buy') {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }
    setBusy(mode);
    setMessage(null);
    try {
      await add(productId, quantity);
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 items-center rounded-full border border-slate-300">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => void onAdd('add')}
          disabled={busy !== null || authStatus === 'loading'}
          className="h-12 flex-1 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:flex-none"
        >
          {busy === 'add' ? 'Adding...' : 'Add to cart'}
        </button>
        <button
          type="button"
          onClick={() => void onAdd('buy')}
          disabled={busy !== null || authStatus === 'loading'}
          className="h-12 w-full rounded-full border border-slate-900 px-6 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-60 sm:w-auto"
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
