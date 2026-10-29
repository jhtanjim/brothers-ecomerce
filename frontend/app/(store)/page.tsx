import Link from 'next/link';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getCategories } from '@/lib/api/categories';
import { getProducts, type ProductListParams } from '@/lib/api/products';
import type { CategorySummary, ProductListItem } from '@/lib/api/types';

const SECTION_SIZE = 8;

type Loaded<T> = { ok: true; data: T } | { ok: false };

async function load<T>(promise: Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await promise };
  } catch {
    return { ok: false };
  }
}

async function loadProducts(params: ProductListParams): Promise<Loaded<ProductListItem[]>> {
  return load(getProducts({ ...params, limit: SECTION_SIZE }).then((result) => result.items));
}

interface ProductSectionProps {
  title: string;
  href: string;
  result: Loaded<ProductListItem[]>;
  /** When true, an empty section is hidden instead of showing an empty state. */
  hideWhenEmpty?: boolean;
  emptyTitle?: string;
}

function ProductSection({
  title,
  href,
  result,
  hideWhenEmpty = false,
  emptyTitle,
}: ProductSectionProps) {
  if (result.ok && result.data.length === 0 && hideWhenEmpty) return null;

  return (
    <section className="mt-12 sm:mt-16">
      <SectionHeading title={title} href={href} />
      {!result.ok ? (
        <ErrorState />
      ) : result.data.length === 0 ? (
        <EmptyState title={emptyTitle ?? 'Nothing here yet'} message="Please check back soon." />
      ) : (
        <ProductGrid products={result.data} />
      )}
    </section>
  );
}

function CategorySection({ result }: { result: Loaded<CategorySummary[]> }) {
  if (result.ok && result.data.length === 0) return null;

  return (
    <section className="mt-12 sm:mt-16">
      <SectionHeading title="Shop by category" />
      {!result.ok ? (
        <ErrorState />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {result.data.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-white hover:shadow-sm"
              >
                <span className="font-medium text-slate-900">{category.name}</span>
                <span className="mt-3 text-xs text-slate-500">
                  {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function HomePage() {
  const [categories, featured, newest, deals] = await Promise.all([
    load(getCategories()),
    loadProducts({ featured: true }),
    loadProducts({ sort: 'newest' }),
    loadProducts({ sort: 'discount' }),
  ]);

  // The "discount" sort puts discounted items first; keep only items that really have a discount.
  const discounted: Loaded<ProductListItem[]> = deals.ok
    ? { ok: true, data: deals.data.filter((product) => product.discountPercent > 0) }
    : deals;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-12 text-white sm:px-12 sm:py-20">
        <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-5xl">
          Everything you need, delivered to your door
        </h1>
        <p className="mt-4 max-w-lg text-indigo-100 sm:text-lg">
          Browse our catalog, find great prices and order in a few clicks.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          Shop all products
        </Link>
      </section>

      <CategorySection result={categories} />
      <ProductSection
        title="Featured products"
        href="/products?featured=true"
        result={featured}
        hideWhenEmpty
      />
      <ProductSection
        title="New arrivals"
        href="/products?sort=newest"
        result={newest}
        emptyTitle="No products yet"
      />
      <ProductSection
        title="Deals"
        href="/products?sort=discount"
        result={discounted}
        hideWhenEmpty
      />
    </main>
  );
}
