import type { Metadata } from 'next';
import Link from 'next/link';
import { MonthlyReportContent } from '@/components/admin/MonthlyReportContent';

export const metadata: Metadata = { title: 'Monthly report' };

export default function AdminMonthlyReportPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monthly report</h1>
      <p className="mt-1 text-sm text-slate-600">
        What the shop earned over a whole month.{' '}
        <Link href="/admin/reports" className="font-medium text-brand-600 hover:text-brand-700">
          Daily report
        </Link>
      </p>
      <div className="mt-6">
        <MonthlyReportContent />
      </div>
    </div>
  );
}
