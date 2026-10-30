'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import type { CategorySummary } from '@/lib/api/types';
import { categoriesInTreeOrder } from '@/lib/categories';
import { SITE_NAME } from '@/lib/format';

const PANEL_ID = 'mobile-menu';
const LINK_CLASS =
  'flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-slate-800 hover:bg-slate-100';

/** Phone/tablet navigation (hidden from md up): search, categories and account links. */
export function MobileMenu({ categories }: { categories: CategorySummary[] }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const next =
    pathname && !['/login', '/register'].includes(pathname)
      ? `?next=${encodeURIComponent(pathname)}`
      : '';

  // Navigating closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, a, button')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      button?.focus();
    };
  }, [open]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      setOpen(false);
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen(true)}
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
      >
        <span className="sr-only">Open menu</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Portal: the sticky header uses backdrop-blur, which would trap a `fixed` overlay inside it. */}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-slate-900/40"
                aria-hidden="true"
                onClick={() => setOpen(false)}
              />
              <div
                ref={panelRef}
                id={PANEL_ID}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-base font-bold tracking-tight text-slate-900">
                    {SITE_NAME}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                  >
                    <span className="sr-only">Close menu</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      className="h-6 w-6"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <form action="/products" method="get" role="search" className="px-4 pt-4">
                  <label htmlFor="mobileSearch" className="sr-only">
                    Search products
                  </label>
                  <input
                    id="mobileSearch"
                    type="search"
                    name="search"
                    maxLength={100}
                    placeholder="Search products"
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </form>

                <nav aria-label="Shop" className="px-2 pt-4">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shop
                  </p>
                  <ul>
                    <li>
                      <Link href="/products" className={LINK_CLASS}>
                        All products
                      </Link>
                    </li>
                    {categoriesInTreeOrder(categories).map((category) => (
                      <li key={category.id} className={category.parentId ? 'pl-4' : undefined}>
                        <Link
                          href={`/products?category=${encodeURIComponent(category.slug)}`}
                          className={LINK_CLASS}
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <nav aria-label="Account" className="mt-auto border-t border-slate-100 px-2 py-4">
                  {status === 'authenticated' && user ? (
                    <>
                      <p className="truncate px-3 pb-2 text-sm text-slate-500">
                        Signed in as <span className="font-medium text-slate-800">{user.name}</span>
                      </p>
                      <Link href="/account/orders" className={LINK_CLASS}>
                        My orders
                      </Link>
                      <Link href="/account/addresses" className={LINK_CLASS}>
                        Addresses
                      </Link>
                      <Link href="/cart" className={LINK_CLASS}>
                        Cart
                      </Link>
                      {user.role === 'ADMIN' ? (
                        <Link href="/admin" className={LINK_CLASS}>
                          Admin dashboard
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void onSignOut()}
                        disabled={signingOut}
                        className={`${LINK_CLASS} w-full text-left disabled:opacity-60`}
                      >
                        {signingOut ? 'Signing out...' : 'Sign out'}
                      </button>
                    </>
                  ) : status === 'unauthenticated' ? (
                    <div className="grid grid-cols-2 gap-2 px-2">
                      <Link
                        href={`/login${next}`}
                        className="flex h-11 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Sign in
                      </Link>
                      <Link
                        href={`/register${next}`}
                        className="flex h-11 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Create account
                      </Link>
                    </div>
                  ) : null}
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
