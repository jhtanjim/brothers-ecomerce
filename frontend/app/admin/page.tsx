import type { Metadata } from 'next';
import { DashboardContent } from '@/components/admin/DashboardContent';

export const metadata: Metadata = { title: 'Dashboard' };

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Sales, orders and stock at a glance.</p>
      <div className="mt-6">
        <DashboardContent />
      </div>
    </div>
  );
}
