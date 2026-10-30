import Link from 'next/link';
import { HeaderActions } from '@/components/auth/HeaderActions';
import { HeaderCartLink } from '@/components/cart/HeaderCartLink';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { getCategories } from '@/lib/api/categories';
import type { CategorySummary } from '@/lib/api/types';
import { SITE_NAME } from '@/lib/format';
import { store } from '@/lib/store';

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
          className="h-11 w-full border border-brand-200 bg-brand-50 pl-10 pr-24 text-sm outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="absolute right-1 top-1 h-9 bg-brand-950 px-4 text-sm font-semibold text-white hover:bg-brand-700"
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
    <>
      {store.announcement ? (
        <div className="bg-brand-950 text-brand-100">
          <p className="mx-auto max-w-7xl px-4 py-2 text-center text-xs tracking-wide sm:px-6 lg:px-8">
            {store.announcement}
          </p>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 md:gap-6 lg:px-8">
          <MobileMenu categories={categories} />

          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center font-display text-2xl font-semibold tracking-[0.25em] text-brand-950 sm:text-3xl"
          >
            {SITE_NAME}
          </Link>

          <SearchForm id="headerSearch" className="hidden flex-1 md:flex md:max-w-xl lg:ml-4" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="hidden md:block">
              <HeaderActions />
            </div>
            <HeaderCartLink />
          </div>
        </div>

        <nav aria-label="Categories" className="hidden border-t border-slate-100 md:block">
          <ul className="mx-auto flex max-w-7xl gap-6 overflow-x-auto whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wider sm:px-6 lg:px-8">
            <li>
              <Link
                href="/products?sort=newest"
                className="inline-flex min-h-11 items-center text-brand-950 hover:underline"
              >
                New arrivals
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="inline-flex min-h-11 items-center text-brand-500 hover:text-brand-950"
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/products?sort=discount"
                className="inline-flex min-h-11 items-center text-rose-700 hover:underline"
              >
                Offers
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {/* On phones search scrolls away, so the sticky bar stays small. */}
      <div className="px-4 py-3 sm:px-6 md:hidden">
        <SearchForm id="headerSearchMobile" className="flex" />
      </div>
    </>
  );
}
