'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { cancelOrder } from '@/lib/api/orders';

const FALLBACK_ERROR = 'Could not cancel this order. Please try again.';

/** Cancel with an inline confirm step. onDone re-fetches the order (also after a 409, so the page shows the real state). */
export function CancelOrderButton({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelOrder(orderId);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : FALLBACK_ERROR);
      setConfirming(false);
      if (err instanceof ApiError && err.status === 409) onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {confirming ? (
        <div>
          <p className="text-sm font-medium text-slate-900">Cancel this order?</p>
          <p className="mt-1 text-sm text-slate-600">
            The items go back in stock. If you have not paid, nothing is charged.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy ? 'Cancelling...' : 'Yes, cancel order'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Keep order
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Changed your mind?</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Cancel order
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
