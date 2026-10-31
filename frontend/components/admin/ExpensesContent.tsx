'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { createExpense, deleteExpense, getExpenses } from '@/lib/api/admin-expenses';
import { ApiError } from '@/lib/api/client';
import type { Expense, ExpenseCategory } from '@/lib/api/types';
import { formatPrice } from '@/lib/format';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'RENT', label: 'Rent' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'UTILITIES', label: 'Electricity, internet, phone' },
  { value: 'TRANSPORT', label: 'Transport and delivery' },
  { value: 'SUPPLIES', label: 'Shop supplies' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTHER', label: 'Other' },
  { value: 'SUPPLIER_PAYMENT', label: 'Supplier payment' },
];

function categoryLabel(category: ExpenseCategory): string {
  return CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

function dhakaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
}

/** Money spent on one day. It feeds the take-home figure and drawer check in the daily report. */
export function ExpensesContent() {
  const [date, setDate] = useState(dhakaToday);
  const [rows, setRows] = useState<Expense[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [fromDrawer, setFromDrawer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    try {
      setRows(await getExpenses(day));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (date) void load(date);
  }, [date, load]);

  const validAmount = MONEY_PATTERN.test(amount) && Number(amount) > 0;

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validAmount || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createExpense({
        date,
        category,
        amount: Number(amount),
        paidFromDrawer: fromDrawer,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setAmount('');
      setDescription('');
      await load(date);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Unable to reach the server. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteExpense(id);
      setConfirmId(null);
      await load(date);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : 'Unable to reach the server. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const total = (rows ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
      <form
        onSubmit={(event) => void onAdd(event)}
        noValidate
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2"
      >
        <h2 className="text-lg font-semibold text-slate-900">Add expense</h2>
        <div>
          <label htmlFor="expenseDate" className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="expenseDate"
            type="date"
            value={date}
            max={dhakaToday()}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="expenseCategory"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Type
          </label>
          <select
            id="expenseCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={INPUT_CLASS}
          >
            {CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          {category === 'SUPPLIER_PAYMENT' ? (
            <p className="mt-1 text-xs text-slate-500">
              Reduces the drawer only. It is not taken off profit, because buying costs already are
              when the goods sell.
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="expenseAmount" className="mb-1 block text-sm font-medium text-slate-700">
            Amount (BDT)
          </label>
          <input
            id="expenseAmount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="expenseNote" className="mb-1 block text-sm font-medium text-slate-700">
            Note (optional)
          </label>
          <input
            id="expenseNote"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={fromDrawer}
            onChange={(e) => setFromDrawer(e.target.checked)}
            className="h-4 w-4"
          />
          Paid with cash from the drawer
        </label>
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!validAmount || busy}
          className="min-h-12 w-full bg-brand-950 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Add expense'}
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
        <h2 className="text-lg font-semibold text-slate-900">Expenses on {date}</h2>
        {failed ? (
          <ErrorState title="Could not load expenses" message="Please try again." />
        ) : rows === null ? (
          <div className="mt-3 h-24 animate-pulse rounded-lg bg-slate-200" aria-busy="true" />
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No expenses on this day.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{categoryLabel(row.category)}</p>
                    <p className="text-slate-500">
                      {row.description ? `${row.description}, ` : ''}
                      {row.paidFromDrawer ? 'from the drawer' : 'not from the drawer'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{formatPrice(row.amount)}</span>
                    {confirmId === row.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDelete(row.id)}
                          className="min-h-11 px-2 font-medium text-rose-600 disabled:opacity-50"
                        >
                          Delete?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="min-h-11 px-2 font-medium text-slate-600"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(row.id)}
                        className="min-h-11 px-2 font-medium text-slate-600 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-slate-200 pt-3 font-bold">
              <span>Total</span>
              <span>{formatPrice((total / 100).toFixed(2))}</span>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
