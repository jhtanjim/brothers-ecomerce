'use client';

import { useEffect, useState } from 'react';
import { categoryLabel } from '@/components/admin/ExpensesContent';
import { ErrorState } from '@/components/ui/ErrorState';
import { getMonthlyReport } from '@/lib/api/admin-dashboard';
import type { MonthlyReport } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

function dhakaMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' })
    .format(new Date())
    .slice(0, 7);
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

/** One month at a glance, with salary and rent spread out over the whole period. */
export function MonthlyReportContent() {
  const [month, setMonth] = useState(dhakaMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setFailed(false);
    setLoading(true);
    getMonthlyReport(month)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  // Quiet days would only make the table longer.
  const activeDays = (report?.days ?? []).filter(
    (day) => Number(day.total) !== 0 || Number(day.running) !== 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="reportMonth" className="mb-1 block text-sm font-medium text-slate-700">
          Month
        </label>
        <input
          id="reportMonth"
          type="month"
          value={month}
          max={dhakaMonth()}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {failed ? (
        <ErrorState title="Could not load the report" message="Please try again." />
      ) : !report ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" aria-busy="true" />
      ) : (
        <div aria-busy={loading} className={loading ? 'opacity-60' : undefined}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              label="Take-home"
              value={formatPrice(report.takeHome)}
              note="Profit after running expenses"
            />
            <Card label="Total sales" value={formatPrice(report.total)} note="After returns" />
            <Card label="Profit" value={formatPrice(report.profit)} note="Before expenses" />
          </div>

          {report.unknownCostUnits > 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {report.unknownCostUnits} item(s) sold had no buying price, so they are left out of
              profit and take-home. The real figures are usually higher.
            </p>
          ) : null}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Expenses by type</h2>
              {report.byCategory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No expenses this month.</p>
              ) : (
                <dl className="mt-3 space-y-2 text-sm">
                  {report.byCategory.map((entry) => (
                    <div key={entry.category} className="flex justify-between gap-3">
                      <dt className="text-slate-600">{categoryLabel(entry.category)}</dt>
                      <dd className="font-medium text-slate-900">{formatPrice(entry.total)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                    <dt>Running expenses</dt>
                    <dd>{formatPrice(report.running)}</dd>
                  </div>
                </dl>
              )}
              {Number(report.supplierPayments) > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Running expenses leave out supplier payments.
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">This month</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Items sold, before returns</dt>
                  <dd className="font-medium text-slate-900">{report.itemsSold}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Returns</dt>
                  <dd className="font-medium text-slate-900">{formatPrice(report.returns)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">Stock bought</dt>
                  <dd className="font-medium text-slate-900">{formatPrice(report.purchases)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Day by day</h2>
            {activeDays.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No sales or expenses this month.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-right text-sm">
                  <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="py-2 pr-3 text-left">
                        Date
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Sales
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Profit
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Expenses
                      </th>
                      <th scope="col" className="py-2 pl-3">
                        Take-home
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDays.map((day) => (
                      <tr key={day.date}>
                        <td className="whitespace-nowrap py-2 pr-3 text-left">{day.date}</td>
                        <td className="px-3 py-2">{formatPrice(day.total)}</td>
                        <td className="px-3 py-2">{formatPrice(day.profit)}</td>
                        <td className="px-3 py-2">{formatPrice(day.running)}</td>
                        <td className="py-2 pl-3 font-medium">{formatPrice(day.takeHome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
