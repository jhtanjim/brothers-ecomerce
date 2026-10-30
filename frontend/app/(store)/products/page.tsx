import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FiltersDisclosure } from '@/components/product/FiltersDisclosure';
import { ProductFilters } from '@/components/product/ProductFilters';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { getCategories } from '@/lib/api/categories';
import { getProductFilters, getProducts } from '@/lib/api/products';
import type { CategorySummary } from '@/lib/api/types';
import { subcategoriesOf, topLevelCategories } from '@/lib/categories';
import { formatPrice } from '@/lib/format';
import {
  buildProductsHref,
  hasActiveFilters,
  isNonDefaultQuery,
  parseProductSearchParams,
  type ProductQuery,
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

/** One removable chip per active filter; each link drops just that filter. */
function activeFilterChips(query: ProductQuery, categories: CategorySummary[]) {
  const chips: { label: string; href: string }[] = [];
  const drop = (overrides: Partial<ProductQuery>) =>
    buildProductsHref(query, { ...overrides, page: 1 });
  if (query.search) chips.push({ label: `"${query.search}"`, href: drop({ search: undefined }) });
  if (query.category) {
    const name = categories.find((category) => category.slug === query.category)?.name;
    chips.push({ label: name ?? query.category, href: drop({ category: undefined }) });
  }
  if (query.minPrice !== undefined) {
    chips.push({
      label: `From ${formatPrice(query.minPrice)}`,
      href: drop({ minPrice: undefined }),
    });
  }
  if (query.maxPrice !== undefined) {
    chips.push({
      label: `Up to ${formatPrice(query.maxPrice)}`,
      href: drop({ maxPrice: undefined }),
    });
  }
  if (query.inStock) chips.push({ label: 'In stock', href: drop({ inStock: undefined }) });
  if (query.featured) chips.push({ label: 'Featured', href: drop({ featured: undefined }) });
  if (query.newArrival) {
    chips.push({ label: 'New arrivals', href: drop({ newArrival: undefined }) });
  }
  if (query.bestSeller) {
    chips.push({ label: 'Best sellers', href: drop({ bestSeller: undefined }) });
  }
  if (query.size) chips.push({ label: `Size ${query.size}`, href: drop({ size: undefined }) });
  if (query.color) chips.push({ label: query.color, href: drop({ color: undefined }) });
  if (query.material) chips.push({ label: query.material, href: drop({ material: undefined }) });
  return chips;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = parseProductSearchParams(await searchParams);

  const [categoriesResult, productsResult, optionsResult] = await Promise.all([
    settle(getCategories()),
    settle(getProducts({ ...query, limit: PAGE_SIZE })),
    settle(getProductFilters(query.category)),
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
    : (activeCategory?.name ??
      (query.newArrival ? 'New arrivals' : query.bestSeller ? 'Best sellers' : 'All products'));
  // The row under the main categories: the open category's subcategories.
  const openParentId = activeCategory?.parentId ?? activeCategory?.id;
  const subcategories = openParentId ? subcategoriesOf(categories, openParentId) : [];
  const filtered = hasActiveFilters(query);
  const chips = activeFilterChips(query, categories);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        {heading}
      </h1>
      {productsResult.ok && (
        <p className="mt-1 text-sm text-slate-500" aria-live="polite">
          {productsResult.data.meta.total}{' '}
          {productsResult.data.meta.total === 1 ? 'product' : 'products'}
        </p>
      )}

      {categories.length > 0 ? (
        <nav aria-label="Categories" className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 whitespace-nowrap">
            {[
              { slug: undefined, name: 'All', id: undefined },
              ...topLevelCategories(categories),
            ].map((category) => {
              const active =
                query.category === category.slug ||
                (category.id !== undefined && category.id === activeCategory?.parentId);
              return (
                <li key={category.slug ?? 'all'}>
                  <Link
                    href={buildProductsHref(query, { category: category.slug, page: 1 })}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex h-10 items-center border px-4 text-sm font-medium ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {subcategories.length > 0 ? (
        <nav aria-label="Subcategories" className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-4 whitespace-nowrap text-sm">
            {subcategories.map((category) => (
              <li key={category.id}>
                <Link
                  href={buildProductsHref(query, { category: category.slug, page: 1 })}
                  aria-current={query.category === category.slug ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center underline-offset-4 hover:underline ${
                    query.category === category.slug
                      ? 'font-semibold text-brand-950 underline'
                      : 'text-slate-600'
                  }`}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-4">
        <FiltersDisclosure activeCount={chips.length}>
          {/* The key remounts the form when the URL filters change, so its fields always match the URL. */}
          <ProductFilters
            key={buildProductsHref(query, { page: 1 })}
            query={query}
            categories={categories}
            options={
              optionsResult.ok ? optionsResult.data : { sizes: [], colors: [], materials: [] }
            }
          />
        </FiltersDisclosure>
      </div>

      {chips.length > 0 ? (
        <ul aria-label="Active filters" className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={chip.href}
                className="inline-flex h-8 items-center gap-1.5 bg-brand-50 px-3 text-sm font-medium text-brand-800 hover:bg-brand-100"
              >
                {chip.label}
                <span aria-hidden="true">&times;</span>
                <span className="sr-only">(remove filter)</span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/products"
              className="text-sm font-medium text-slate-600 underline hover:text-slate-900"
            >
              Clear all
            </Link>
          </li>
        </ul>
      ) : null}

      <section className="mt-8" aria-labelledby="results-heading">
        <h2 id="results-heading" className="sr-only">
          Product results
        </h2>
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
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
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
