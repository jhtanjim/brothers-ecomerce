'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getPurchases } from '@/lib/api/admin-purchases';
import type { PaginationMeta, StockPurchase } from '@/lib/api/types';
import { formatPrice, optionLabel } from '@/lib/format';

const PAGE_SIZE = 20;

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function PurchasesListContent() {
  const params = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [items, setItems] = useState<StockPurchase[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPurchases(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setMeta(result.meta);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="space-y-4">
      <Link
        href="/admin/purchases/new"
        className="inline-flex min-h-11 items-center bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Add purchase
      </Link>

      {params.get('saved') ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Purchase saved and added to stock.
        </p>
      ) : null}

      {failed ? (
        <ErrorState title="Could not load purchases" message="Please try again." />
      ) : items === null ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No purchases yet. Add one when new stock arrives.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((purchase) => (
            <li key={purchase.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{purchase.supplierName}</p>
                  <p className="text-xs text-slate-500">
                    {purchase.purchaseNumber}, {dateTime.format(new Date(purchase.createdAt))}
                  </p>
                </div>
                <p className="font-semibold text-slate-900">{formatPrice(purchase.totalCost)}</p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {purchase.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} x {item.name}
                    {optionLabel(item.size, item.color)
                      ? ` (${optionLabel(item.size, item.color)})`
                      : ''}{' '}
                    at {formatPrice(item.unitCost)}
                  </li>
                ))}
              </ul>
              {purchase.note ? (
                <p className="mt-2 text-sm text-slate-500">{purchase.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {meta ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          hrefFor={(next) => `/admin/purchases?page=${next}`}
        />
      ) : null}
    </div>
  );
}
