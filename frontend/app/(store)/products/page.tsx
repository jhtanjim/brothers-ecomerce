import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProductFilters } from '@/components/product/ProductFilters';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getCategories } from '@/lib/api/categories';
import { getProducts } from '@/lib/api/products';
import {
  buildProductsHref,
  hasActiveFilters,
  isNonDefaultQuery,
  parseProductSearchParams,
  type RawSearchParams,
} from '@/lib/product-search';

const PAGE_SIZE = 12;

interface ProductsPageProps {
  searchParams: Promise<RawSearchParams>;
}

type Settled<T> = { ok: true; data: T } | { ok: false };

async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch {
    return { ok: false };
  }
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const query = parseProductSearchParams(await searchParams);
  const nonDefault = isNonDefaultQuery(query);

  return {
    title: query.search ? `Results for "${query.search}"` : 'Products',
    description:
      'Browse all products. Filter by category and price, and sort to find what you need.',
    // Only the plain listing is indexable; filter and page combinations are not.
    alternates: nonDefault ? undefined : { canonical: '/products' },
    robots: nonDefault ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = parseProductSearchParams(await searchParams);

  const [categoriesResult, productsResult] = await Promise.all([
    settle(getCategories()),
    settle(getProducts({ ...query, limit: PAGE_SIZE })),
  ]);

  // A page number past the end (for example from an old link) goes to the last real page.
  if (
    productsResult.ok &&
    productsResult.data.items.length === 0 &&
    productsResult.data.meta.total > 0 &&
    query.page > productsResult.data.meta.totalPages
  ) {
    redirect(buildProductsHref(query, { page: productsResult.data.meta.totalPages }));
  }

  const categories = categoriesResult.ok ? categoriesResult.data : [];
  const activeCategory = categories.find((category) => category.slug === query.category);
  const heading = query.search
    ? `Results for "${query.search}"`
    : (activeCategory?.name ?? 'All products');
  const filtered = hasActiveFilters(query);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{heading}</h1>
      {productsResult.ok && (
        <p className="mt-1 text-sm text-slate-500" aria-live="polite">
          {productsResult.data.meta.total}{' '}
          {productsResult.data.meta.total === 1 ? 'product' : 'products'}
        </p>
      )}

      <div className="mt-6">
        {/* The key remounts the form when the URL filters change, so its fields always match the URL. */}
        <ProductFilters
          key={buildProductsHref(query, { page: 1 })}
          query={query}
          categories={categories}
        />
      </div>

      <section className="mt-8" aria-label="Product results">
        {!productsResult.ok ? (
          <ErrorState title="We could not load products" message="Please try again in a moment." />
        ) : productsResult.data.items.length === 0 ? (
          <div>
            <EmptyState
              title={filtered ? 'No products match your filters' : 'No products yet'}
              message={
                filtered
                  ? 'Try removing a filter or searching for something else.'
                  : 'Please check back soon.'
              }
            />
            {filtered && (
              <p className="mt-4 text-center">
                <Link
                  href="/products"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Clear all filters
                </Link>
              </p>
            )}
          </div>
        ) : (
          <>
            <ProductGrid products={productsResult.data.items} />
            <Pagination
              page={productsResult.data.meta.page}
              totalPages={productsResult.data.meta.totalPages}
              hrefFor={(page) => buildProductsHref(query, { page })}
            />
          </>
        )}
      </section>
    </main>
  );
}
