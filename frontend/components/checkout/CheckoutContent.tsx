'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCart } from '@/components/cart/CartProvider';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

const CHECKOUT_PATH = '/checkout';

function CheckoutSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true">
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}

export function CheckoutContent() {
  const router = useRouter();
  const { status: authStatus, user } = useAuth();
  const { cart, status, reload } = useCart();
  // Once the order is placed the cart empties; this keeps the empty state from flashing before we navigate.
  const [placed, setPlaced] = useState(false);

  // Signed-out visitors go to login and come straight back here afterwards.
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(CHECKOUT_PATH)}`);
    }
  }, [authStatus, router]);

  function onPlaced(orderId: string) {
    setPlaced(true);
    void reload();
    router.replace(`/account/orders/${encodeURIComponent(orderId)}`);
  }

  if (placed) {
    return (
      <p role="status" className="text-sm text-slate-600">
        Order placed. Taking you to your order...
      </p>
    );
  }

  if (authStatus !== 'authenticated' || !user) {
    return <CheckoutSkeleton />;
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
    return <CheckoutSkeleton />;
  }

  if (cart.items.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Your cart is empty"
          message="Add something to your cart before checking out."
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

  return <CheckoutForm user={user} cart={cart} onPlaced={onPlaced} />;
}
