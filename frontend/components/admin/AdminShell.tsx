'use client';

import Link from 'next/link';
import { PageGuide } from '@/components/admin/PageGuide';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { SITE_NAME } from '@/lib/format';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/pos', label: 'POS' },
  { href: '/admin/reports', label: 'Daily report' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/purchases', label: 'Stock purchases' },
  { href: '/admin/labels', label: 'Barcode labels' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/settings', label: 'Settings' },
];

function ShellSkeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-slate-50" aria-busy="true">
      <div className="h-14 border-b border-slate-200 bg-white" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-40 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}

/**
 * Admin chrome plus a UX-only role gate. The real protection is the backend: every admin
 * endpoint checks the ADMIN role, so a customer who reaches this page still gets no data.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/admin/payments')}`);
    } else if (status === 'authenticated' && user?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [status, user, pathname, router]);

  if (status !== 'authenticated' || user?.role !== 'ADMIN') {
    return <ShellSkeleton />;
  }

  async function onSignOut() {
    try {
      await logout();
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <Link href="/admin" className="text-base font-bold tracking-tight text-slate-900">
            {SITE_NAME}
          </Link>
          <p className="text-xs text-slate-500">Admin</p>
        </div>
        <nav
          aria-label="Admin"
          className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4"
        >
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-3 text-sm">
          <Link href="/" className="text-slate-600 hover:text-brand-600">
            Back to store
          </Link>
          <span className="text-slate-700">{user.name}</span>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <PageGuide />
          {children}
        </main>
      </div>
    </div>
  );
}
