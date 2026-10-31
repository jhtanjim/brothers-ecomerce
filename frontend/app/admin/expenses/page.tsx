import type { Metadata } from 'next';
import { ExpensesContent } from '@/components/admin/ExpensesContent';

export const metadata: Metadata = { title: 'Expenses' };

export default function AdminExpensesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expenses</h1>
      <p className="mt-1 text-sm text-slate-600">
        Record what the shop spends each day. The daily report uses it for take-home and the drawer.
      </p>
      <div className="mt-6">
        <ExpensesContent />
      </div>
    </div>
  );
}
