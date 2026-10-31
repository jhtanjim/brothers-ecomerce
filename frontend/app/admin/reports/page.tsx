import type { Metadata } from 'next';
import Link from 'next/link';
import { DailyReportContent } from '@/components/admin/DailyReportContent';

export const metadata: Metadata = { title: 'Daily report' };

export default function AdminReportsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily report</h1>
      <p className="mt-1 text-sm text-slate-600">
        Check the cash drawer at closing, and see shop and online sales for any day.{' '}
        <Link
          href="/admin/reports/monthly"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Monthly report
        </Link>
      </p>
      <div className="mt-6">
        <DailyReportContent />
      </div>
    </div>
  );
}
