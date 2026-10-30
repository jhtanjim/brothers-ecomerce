'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { getDailyReport } from '@/lib/api/admin-dashboard';
import type { DailyReport, PaymentMethod } from '@/lib/api/types';
import { paymentMethodLabel } from '@/components/order/StatusBadges';
import { formatPrice } from '@/lib/format';

const POS_METHODS: PaymentMethod[] = ['CASH', 'BKASH', 'NAGAD'];
const ONLINE_METHODS: PaymentMethod[] = ['BKASH', 'NAGAD'];

function dhakaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function MethodTable({
  title,
  methods,
  rows,
}: {
  title: string;
  methods: PaymentMethod[];
  rows: DailyReport['pos'];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">
        {methods.map((method) => {
          const row = rows.methods.find((entry) => entry.method === method);
          return (
            <div key={method} className="flex justify-between gap-3">
              <dt className="text-slate-600">
                {paymentMethodLabel(method)} ({row?.sales ?? 0})
              </dt>
              <dd className="font-medium text-slate-900">{formatPrice(row?.total ?? '0')}</dd>
            </div>
          );
        })}
        <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
          <dt>Total ({rows.sales})</dt>
          <dd>{formatPrice(rows.total)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** What was sold on one Dhaka calendar day, for checking the cash drawer at closing. */
export function DailyReportContent() {
  const [date, setDate] = useState(dhakaToday);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setFailed(false);
    getDailyReport(date)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const cash = report?.pos.methods.find((entry) => entry.method === 'CASH');

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="reportDate" className="mb-1 block text-sm font-medium text-slate-700">
          Date
        </label>
        <input
          id="reportDate"
          type="date"
          value={date}
          max={dhakaToday()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {failed ? (
        <ErrorState title="Could not load the report" message="Please try again." />
      ) : !report ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              label="Cash in drawer from sales"
              value={formatPrice(cash?.total ?? '0')}
              note="Add your opening cash to compare with the drawer"
            />
            <Card label="Total sales" value={formatPrice(report.total)} />
            <Card label="Items sold" value={String(report.itemsSold)} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <MethodTable title="Shop sales" methods={POS_METHODS} rows={report.pos} />
            <MethodTable title="Online sales" methods={ONLINE_METHODS} rows={report.online} />
          </div>

          {report.cancelledPos.sales > 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {report.cancelledPos.sales} shop sale(s) from this day were cancelled, worth{' '}
              {formatPrice(report.cancelledPos.total)}. They are not in the totals above.
            </p>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Best sellers this day</h2>
            {report.topItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No sales on this day.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {report.topItems.map((item) => (
                  <li key={item.productId} className="flex justify-between gap-3 py-2">
                    <Link
                      href={`/admin/products/${encodeURIComponent(item.productId)}/edit`}
                      className="min-w-0 text-slate-900 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="shrink-0 text-slate-600">
                      {item.quantity} sold, {formatPrice(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-slate-500">
            Online sales count on the day the order was placed, once payment is approved.
          </p>
        </>
      )}
    </div>
  );
}
