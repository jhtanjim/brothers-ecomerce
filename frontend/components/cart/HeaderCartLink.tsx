'use client';

import Link from 'next/link';
import { useCart } from '@/components/cart/CartProvider';

export function HeaderCartLink() {
  const { itemCount } = useCart();
  const label = itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Cart';

  return (
    <Link
      href="/cart"
      aria-label={label}
      className="relative flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 hover:text-brand-700"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.1L21 7H6" />
      </svg>
      {itemCount > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold leading-5 text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      ) : null}
    </Link>
  );
}
