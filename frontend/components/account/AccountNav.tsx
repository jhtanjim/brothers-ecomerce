'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/account/orders', label: 'My orders' },
  { href: '/account/addresses', label: 'Addresses' },
];

/** Tabs shared by the customer account pages. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-2 border-b border-slate-200">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold ${
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
