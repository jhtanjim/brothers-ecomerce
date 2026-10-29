'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { useCart } from '@/components/cart/CartProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ApiError } from '@/lib/api/client';
import type { CartLine } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const CART_PATH = '/cart';
const CLEAR_KEY = 'clear';

function CartSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-28 rounded-xl bg-slate-100" />
      <div className="h-28 rounded-xl bg-slate-100" />
    </div>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status !== 0 ? err.message : fallback;
}

export function CartPageContent() {
  const router = useRouter();
  const { status: authStatus } = useAuth();
  const { cart, status, update, remove, clear, reload } = useCart();
  // The id of the line being changed (or CLEAR_KEY); only one action runs at a time.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Signed-out visitors go to login and come straight back here afterwards.
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(CART_PATH)}`);
    }
  }, [authStatus, router]);

  async function run(key: string, action: () => Promise<void>, fallback: string) {
    setBusyKey(key);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice(errorText(err, fallback));
      // The cart on screen may be stale (line gone, stock changed), so refresh it.
      void reload();
    } finally {
      setBusyKey(null);
    }
  }

  function onChangeQuantity(line: CartLine, quantity: number) {
    void run(
      line.id,
      () => update(line.id, quantity),
      'Could not update the quantity. Please try again.',
    );
  }

  function onRemove(line: CartLine) {
    void run(line.id, () => remove(line.id), 'Could not remove this item. Please try again.');
  }

  function onClear() {
    if (!window.confirm('Remove all items from your cart?')) return;
    void run(CLEAR_KEY, () => clear(), 'Could not clear the cart. Please try again.');
  }

  if (authStatus !== 'authenticated') {
    return <CartSkeleton />;
  }

  if (status === 'error' && !cart) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load your cart"
          message="Please check your connection and try again."
        />
        <div className="text-center">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!cart) {
    return <CartSkeleton />;
  }

  if (cart.items.length === 0) {
    return (
      <div className="space-y-4">
        {notice ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {notice}
          </p>
        ) : null}
        <EmptyState
          title="Your cart is empty"
          message="Browse our products and add something you like."
        />
        <div className="text-center">
          <Link
            href="/products"
            className="inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const busy = busyKey !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        {notice ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {notice}
          </p>
        ) : null}

        {cart.hasIssues ? (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Some items need your attention before you can check out.
          </p>
        ) : null}

        <ul className="space-y-4">
          {cart.items.map((line) => (
            <CartLineItem
              key={line.id}
              line={line}
              busy={busy}
              onChangeQuantity={onChangeQuantity}
              onRemove={onRemove}
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="min-h-11 text-sm font-medium text-slate-600 hover:text-rose-600 disabled:opacity-40"
        >
          {busyKey === CLEAR_KEY ? 'Clearing...' : 'Clear cart'}
        </button>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:sticky lg:top-36">
        <h2 className="text-lg font-bold text-slate-900">Order summary</h2>
        <dl className="mt-4 flex items-baseline justify-between text-sm">
          <dt className="text-slate-600">
            Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
          </dt>
          <dd className="text-base font-semibold text-slate-900">{formatPrice(cart.subtotal)}</dd>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          The delivery charge for your city and any coupon are shown at checkout, before you order.
        </p>

        {cart.hasIssues ? (
          <p
            role="status"
            className="mt-5 rounded-full bg-slate-100 px-6 py-3 text-center text-sm font-semibold text-slate-500"
          >
            Fix the items above to check out
          </p>
        ) : (
          <Link
            href="/checkout"
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Proceed to checkout
          </Link>
        )}

        <Link
          href="/products"
          className="mt-2 flex min-h-11 items-center justify-center text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
