'use client';

import { useState } from 'react';
import { updateCashDay } from '@/lib/api/admin-expenses';
import type { DailyReport } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

function moneyText(value: string | null): string {
  return value === null ? '' : String(Number(value));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/** Morning: enter the opening cash. Closing: count the drawer and see any difference. */
export function CashDrawerPanel({
  date,
  drawer,
  onSaved,
}: {
  date: string;
  drawer: DailyReport['drawer'];
  onSaved: () => void;
}) {
  const [opening, setOpening] = useState(moneyText(drawer.opening));
  const [counted, setCounted] = useState(moneyText(drawer.counted));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = (text: string) => text === '' || MONEY_PATTERN.test(text);
  const canSave = valid(opening) && valid(counted) && !busy;
  const difference = drawer.difference === null ? null : Number(drawer.difference);

  async function onSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await updateCashDay(date, {
        openingCash: opening === '' ? null : Number(opening),
        countedCash: counted === '' ? null : Number(counted),
      });
      onSaved();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Cash drawer</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="openingCash" className="mb-1 block text-sm font-medium text-slate-700">
            Opening cash (morning)
          </label>
          <input
            id="openingCash"
            inputMode="decimal"
            value={opening}
            onChange={(e) => setOpening(e.target.value.trim())}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="countedCash" className="mb-1 block text-sm font-medium text-slate-700">
            Cash counted (closing)
          </label>
          <input
            id="countedCash"
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value.trim())}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={!canSave}
        onClick={() => void onSave()}
        className="mt-3 min-h-11 border border-slate-400 px-5 text-sm font-semibold text-slate-900 hover:border-slate-900 disabled:opacity-50"
      >
        {busy ? 'Saving...' : 'Save'}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
        <Row label="Cash sales" value={`+${formatPrice(drawer.cashSales)}`} />
        <Row label="Cash refunds" value={`-${formatPrice(drawer.cashRefunds)}`} />
        <Row label="Expenses from the drawer" value={`-${formatPrice(drawer.drawerExpenses)}`} />
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold">
          <dt>Should be in the drawer</dt>
          <dd>{drawer.expected === null ? 'Enter opening cash' : formatPrice(drawer.expected)}</dd>
        </div>
      </dl>

      {difference !== null ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            difference === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {difference === 0
            ? 'The drawer matches.'
            : difference < 0
              ? `The drawer is short by ${formatPrice(Math.abs(difference).toFixed(2))}.`
              : `The drawer has ${formatPrice(difference.toFixed(2))} extra.`}
        </p>
      ) : null}
    </section>
  );
}
