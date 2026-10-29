'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

const AUTH_PAGES = ['/login', '/register'];

export function HeaderActions() {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return <div className="ml-auto h-9 w-28 md:ml-0" aria-hidden="true" />;
  }

  if (status === 'unauthenticated' || !user) {
    const next = pathname && !AUTH_PAGES.includes(pathname) ? `?next=${encodeURIComponent(pathname)}` : '';
    return (
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <Link
          href={`/login${next}`}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600"
        >
          Sign in
        </Link>
        <Link
          href={`/register${next}`}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-600 hover:text-indigo-600"
        >
          Create account
        </Link>
      </div>
    );
  }

  async function onSignOut() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      router.replace('/');
      router.refresh();
    }
  }

  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <details className="relative ml-auto md:ml-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:text-indigo-600 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700">
          {firstName.charAt(0)}
        </span>
        <span className="max-w-[8rem] truncate">{firstName}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <Link
          href="/account/orders"
          onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
          className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          My orders
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy}
          className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </details>
  );
}