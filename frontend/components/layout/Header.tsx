import Link from 'next/link';
import { HeaderActions } from '@/components/auth/HeaderActions';
import { HeaderCartLink } from '@/components/cart/HeaderCartLink';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { getCategories } from '@/lib/api/categories';
import type { CategorySummary } from '@/lib/api/types';
import { SITE_NAME } from '@/lib/format';

/** The header must never break the whole site if the API is down. */
async function loadCategories(): Promise<CategorySummary[]> {
  try {
    return await getCategories();
  } catch {
    return [];
  }
}

function SearchForm({ id, className }: { id: string; className: string }) {
  return (
    <form action="/products" method="get" role="search" className={className}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <div className="relative w-full">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id={id}
          type="search"
          name="search"
          maxLength={100}
          placeholder="Search for products"
          className="h-11 w-full rounded-full border border-slate-300 bg-slate-50 pl-10 pr-24 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="absolute right-1 top-1 h-9 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export async function Header() {
  const categories = await loadCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="bg-brand-900 text-brand-50">
        <p className="mx-auto max-w-7xl px-4 py-1.5 text-center text-xs sm:px-6 lg:px-8">
          Pay with <span className="font-semibold">bKash</span> or{' '}
          <span className="font-semibold">Nagad</span>
          <span className="hidden sm:inline"> &middot; Track every order from your account</span>
        </p>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 md:gap-6 lg:px-8">
        <MobileMenu categories={categories} />

        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base font-extrabold text-white"
          >
            {SITE_NAME.charAt(0)}
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            {SITE_NAME}
          </span>
        </Link>

        <SearchForm id="headerSearch" className="hidden flex-1 md:flex md:max-w-xl lg:ml-4" />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden md:block">
            <HeaderActions />
          </div>
          <HeaderCartLink />
        </div>
      </div>

      <div className="px-4 pb-3 sm:px-6 md:hidden">
        <SearchForm id="headerSearchMobile" className="flex" />
      </div>

      <nav aria-label="Categories" className="hidden border-t border-slate-100 md:block">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto whitespace-nowrap px-2 py-1.5 text-sm sm:px-4 lg:px-6">
          <li>
            <Link
              href="/products"
              className="block rounded-full px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
            >
              All products
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="block rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
