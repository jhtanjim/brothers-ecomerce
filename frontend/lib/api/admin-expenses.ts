import { apiFetch } from './client';
import type { Expense, ExpenseCategory } from './types';

export function getExpenses(date: string): Promise<Expense[]> {
  return apiFetch<Expense[]>(`/admin/expenses?date=${encodeURIComponent(date)}`);
}

export function createExpense(input: {
  date: string;
  category: ExpenseCategory;
  amount: number;
  paidFromDrawer: boolean;
  description?: string;
}): Promise<Expense> {
  return apiFetch<Expense>('/admin/expenses', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteExpense(id: string): Promise<null> {
  return apiFetch<null>(`/admin/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** A null clears the value. */
export function updateCashDay(
  date: string,
  input: { openingCash: number | null; countedCash: number | null },
): Promise<null> {
  return apiFetch<null>(`/admin/cash-days/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
