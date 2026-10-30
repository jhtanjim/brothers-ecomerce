import Link from 'next/link';
import { StoreHero } from '@/components/home/StoreHero';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getCategories } from '@/lib/api/categories';
import { getProducts, type ProductListParams } from '@/lib/api/products';
import type { CategorySummary, ProductListItem } from '@/lib/api/types';

const SECTION_SIZE = 8;
const HERO_PICKS = 3;

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
    <section className="mt-14 sm:mt-20">
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
    <section className="mt-14 sm:mt-20">
      <SectionHeading title="Shop by category" href="/products" linkLabel="All products" />
      {!result.ok ? (
        <ErrorState />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {result.data.map((category) => (
            <li key={category.id}>
              <Link
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"
                >
                  {category.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {category.productCount} {category.productCount === 1 ? 'product' : 'products'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STEPS = [
  {
    title: 'Place your order',
    text: 'Add products to your cart, enter your delivery address and choose bKash or Nagad.',
  },
  {
    title: 'Send the payment',
    text: 'Pay the order total to our merchant number, then submit your transaction ID on the order page.',
  },
  {
    title: 'We verify and deliver',
    text: 'We confirm your payment, pack your order and you can follow every step from My orders.',
  },
];

function HowItWorks() {
  return (
    <section
      aria-labelledby="howItWorks"
      className="mt-14 rounded-2xl bg-slate-50 p-6 sm:mt-20 sm:p-10"
    >
      <h2
        id="howItWorks"
        className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl"
      >
        How ordering works
      </h2>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
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

  const pickSource = featured.ok && featured.data.length > 0 ? featured : newest;
  const picks = pickSource.ok
    ? pickSource.data.filter((product) => product.stockQuantity > 0).slice(0, HERO_PICKS)
    : [];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <StoreHero picks={picks} />

      <CategorySection result={categories} />
      <ProductSection
        title="Featured products"
        href="/products?featured=true"
        result={featured}
        hideWhenEmpty
      />
      <ProductSection
        title="Deals"
        href="/products?sort=discount"
        result={discounted}
        hideWhenEmpty
      />
      <ProductSection
        title="New arrivals"
        href="/products?sort=newest"
        result={newest}
        emptyTitle="No products yet"
      />
      <HowItWorks />
    </main>
  );
}
