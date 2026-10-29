import Link from 'next/link';
import { HeaderActions } from '@/components/auth/HeaderActions';
import { HeaderCartLink } from '@/components/cart/HeaderCartLink';
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

export async function Header() {
  const categories = await loadCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          {SITE_NAME}
        </Link>

        <form
          action="/products"
          method="get"
          role="search"
          className="order-last flex w-full gap-2 md:order-none md:ml-auto md:w-96"
        >
          <input
            type="search"
            name="search"
            maxLength={100}
            placeholder="Search products"
            aria-label="Search products"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
        <HeaderActions />
        <HeaderCartLink />
      </div>

      <nav aria-label="Categories" className="border-t border-slate-100">
        <ul className="mx-auto flex max-w-7xl gap-5 overflow-x-auto whitespace-nowrap px-4 py-2 text-sm sm:px-6 lg:px-8">
          <li>
            <Link href="/products" className="font-medium text-slate-700 hover:text-indigo-600">
              All products
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="text-slate-600 hover:text-indigo-600"
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
