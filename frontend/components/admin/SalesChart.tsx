'use client';

import { useEffect, useState } from 'react';
import { getDashboardSales } from '@/lib/api/admin-dashboard';
import type { DashboardSales } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const OPTIONS = [7, 30, 90];
const W = 600;
const H = 160;

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: DashboardSales } | { kind: 'error' };

export function SalesChart() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getDashboardSales(days)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [days, attempt]);

  const points = state.kind === 'ready' ? state.data.points : [];
  const values = points.map((p) => Math.round(Number(p.sales) * 100));
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const barW = points.length > 0 ? W / points.length : W;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sales</h2>
          {state.kind === 'ready' ? (
            <p className="text-xs text-slate-500">
              {formatPrice((total / 100).toFixed(2))} in the last {days} days
            </p>
          ) : null}
        </div>
        <div className="flex gap-2" role="group" aria-label="Period">
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={`rounded-lg border px-3 py-1 text-sm font-medium ${
                days === option
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option} days
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {state.kind === 'loading' ? (
          <div className="h-40 animate-pulse rounded-lg bg-slate-100" aria-busy="true" />
        ) : null}
        {state.kind === 'error' ? (
          <p className="py-10 text-center text-sm text-slate-600">
            Could not load the chart.{' '}
            <button
              type="button"
              onClick={() => setAttempt((count) => count + 1)}
              className="font-medium text-brand-600 underline"
            >
              Try again
            </button>
          </p>
        ) : null}
        {state.kind === 'ready' ? (
          <div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-40 w-full"
              role="img"
              aria-label="Daily sales"
            >
              <line x1="0" y1={H} x2={W} y2={H} stroke="#e2e8f0" strokeWidth="1" />
              {points.map((point, i) => {
                const h = (values[i] / max) * (H - 4);
                return (
                  <rect
                    key={point.date}
                    x={i * barW + 1}
                    y={H - h}
                    width={Math.max(barW - 2, 1)}
                    height={h}
                    rx="2"
                    fill="#262421"
                  >
                    <title>{`${point.date}: ${formatPrice(point.sales)} (${point.orders} orders)`}</title>
                  </rect>
                );
              })}
            </svg>
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>{points[0]?.date}</span>
              <span>{points[points.length - 1]?.date}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
