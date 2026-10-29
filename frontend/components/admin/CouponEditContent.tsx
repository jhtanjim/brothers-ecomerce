'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CouponForm } from '@/components/admin/CouponForm';
import { ErrorState } from '@/components/ui/ErrorState';
import { getAdminCoupon } from '@/lib/api/admin-coupons';
import { ApiError } from '@/lib/api/client';
import type { AdminCoupon } from '@/lib/api/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; coupon: AdminCoupon }
  | { kind: 'missing' }
  | { kind: 'error' };

export function CouponEditContent({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getAdminCoupon(id)
      .then((coupon) => {
        if (!cancelled) setState({ kind: 'ready', coupon });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(
          err instanceof ApiError && err.status === 404 ? { kind: 'missing' } : { kind: 'error' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state.kind === 'loading') {
    return (
      <div className="h-64 max-w-2xl animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
    );
  }
  if (state.kind === 'missing') {
    return (
      <div className="space-y-4">
        <ErrorState title="Coupon not found" message="It may have been deleted." />
        <Link
          href="/admin/coupons"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to coupons
        </Link>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Could not load the coupon"
          message="Please check your connection and try again."
        />
        <button
          type="button"
          onClick={() => setAttempt((count) => count + 1)}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }
  return <CouponForm coupon={state.coupon} />;
}
