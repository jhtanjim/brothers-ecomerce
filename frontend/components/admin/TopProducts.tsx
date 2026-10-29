'use client';

import { useEffect, useState } from 'react';
import { getDashboardTopProducts } from '@/lib/api/admin-dashboard';
import type { DashboardTopProduct } from '@/lib/api/types';

type LoadState =
  { kind: 'loading' } | { kind: 'ready'; items: DashboardTopProduct[] } | { kind: 'error' };

export function TopProducts() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getDashboardTopProducts(5)
      .then((items) => {
        if (!cancelled) setState({ kind: 'ready', items });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">Top products</h2>
        <p className="text-xs text-slate-500">By units sold</p>
      </div>
      {state.kind === 'loading' ? (
        <div className="m-4 h-24 animate-pulse rounded-lg bg-slate-100" aria-busy="true" />
      ) : null}
      {state.kind === 'error' ? (
        <p className="px-4 py-6 text-center text-sm text-slate-600">Could not load top products.</p>
      ) : null}
      {state.kind === 'ready' && state.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No sales yet.</p>
      ) : null}
      {state.kind === 'ready' && state.items.length > 0 ? (
        <ol className="divide-y divide-slate-100">
          {state.items.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 text-slate-400">{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.sku}</p>
                </div>
              </div>
              <p className="shrink-0 font-semibold text-slate-900">{item.soldCount} sold</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
