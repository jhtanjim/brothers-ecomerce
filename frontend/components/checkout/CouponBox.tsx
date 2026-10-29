'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ApiError } from '@/lib/api/client';
import { validateCoupon } from '@/lib/api/coupons';
import type { ValidateCouponResult } from '@/lib/api/types';

interface CouponBoxProps {
  applied: ValidateCouponResult | null;
  onApplied: (coupon: ValidateCouponResult | null) => void;
  disabled?: boolean;
}

function describe(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Could not check the coupon. Please try again.';
  if (err.status === 0) return 'Unable to reach the server. Please try again.';
  if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (err.status === 401) return 'Your session has expired. Please sign in again.';
  return err.message;
}

export function CouponBox({ applied, onApplied, disabled = false }: CouponBoxProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const value = code.trim().toUpperCase();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      onApplied(await validateCoupon(value));
      setCode('');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  // Inside the checkout form: Enter must apply the coupon, never place the order.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void apply();
    }
  }

  return (
    <section aria-labelledby="coupon-heading">
      <h2 id="coupon-heading" className="text-lg font-semibold text-slate-900">
        Coupon code
      </h2>

      {applied ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <p className="text-emerald-900">
            <span className="font-semibold">{applied.code}</span> applied
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplied(null)}
            className="font-medium text-emerald-900 underline disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Coupon code"
              value={code}
              maxLength={50}
              autoComplete="off"
              disabled={disabled || busy}
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              onKeyDown={onKeyDown}
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              disabled={disabled || busy || code.trim() === ''}
              onClick={() => void apply()}
              className="h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Checking...' : 'Apply'}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-rose-600">
              {error}
            </p>
          ) : null}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">
        The discount shown is a preview. It is confirmed when you place the order.
      </p>
    </section>
  );
}
