'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { getLowStock } from '@/lib/api/admin-dashboard';
import type { DashboardLowStockItem } from '@/lib/api/types';
import { optionLabel } from '@/lib/format';

/** Everything to reorder, each size and colour on its own line, emptiest first. */
export function LowStockContent() {
  const [items, setItems] = useState<DashboardLowStockItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLowStock()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <ErrorState title="Could not load the list" message="Please try again." />;
  if (!items)
    return <div className="h-48 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/purchases/new"
        className="inline-flex min-h-11 items-center bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Add purchase
      </Link>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nothing is running low.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {items.map((item) => (
            <li
              key={item.sku}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/products/${encodeURIComponent(item.id)}/edit`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {item.name}
                </Link>
                {optionLabel(item.size, item.color) ? (
                  <p className="text-slate-600">{optionLabel(item.size, item.color)}</p>
                ) : null}
                <p className="font-mono text-xs text-slate-500">{item.sku}</p>
              </div>
              <p
                className={`shrink-0 font-semibold ${
                  item.stockQuantity === 0 ? 'text-rose-700' : 'text-amber-700'
                }`}
              >
                {item.stockQuantity === 0 ? 'Sold out' : `${item.stockQuantity} left`}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  (alert at {item.lowStockThreshold})
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
