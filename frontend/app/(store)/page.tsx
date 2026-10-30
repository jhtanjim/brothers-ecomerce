import Image from 'next/image';
import Link from 'next/link';
import { HomeHero } from '@/components/home/HomeHero';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ErrorState } from '@/components/ui/ErrorState';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getCategories } from '@/lib/api/categories';
import { getProducts, type ProductListParams } from '@/lib/api/products';
import type { CategorySummary, ProductListItem } from '@/lib/api/types';
import { topLevelCategories } from '@/lib/categories';
import { store } from '@/lib/store';

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

/** Sections with no real products hide themselves, so the page never shows empty promises. */
function ProductSection({
  title,
  href,
  result,
}: {
  title: string;
  href: string;
  result: Loaded<ProductListItem[]>;
}) {
  if (result.ok && result.data.length === 0) return null;
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
      <SectionHeading title={title} href={href} />
      {result.ok ? <ProductGrid products={result.data} /> : <ErrorState />}
    </section>
  );
}

/** next/image only allows Cloudinary and local files; other URLs fall back to the type tile. */
function categoryImage(category: CategorySummary): string | null {
  const url = category.imageUrl;
  return url?.startsWith('https://res.cloudinary.com/') || url?.startsWith('/') ? url : null;
}

function CategorySection({ result }: { result: Loaded<CategorySummary[]> }) {
  if (result.ok && result.data.length === 0) return null;
  return (
    <section className="mx-auto mt-16 max-w-7xl px-4 sm:mt-24 sm:px-6 lg:px-8">
      <SectionHeading title="Shop by category" href="/products" linkLabel="View all" />
      {result.ok ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {topLevelCategories(result.data).map((category) => {
            const image = categoryImage(category);
            return (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden bg-brand-100 p-4 sm:p-6"
                >
                  {image ? (
                    <>
                      <Image
                        src={image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 bg-brand-950/30" aria-hidden="true" />
                    </>
                  ) : null}
                  <span
                    className={`relative font-display text-3xl font-semibold uppercase leading-none sm:text-4xl ${
                      image ? 'text-white' : 'text-brand-950'
                    }`}
                  >
                    {category.name}
                  </span>
                  <span
                    className={`relative mt-2 text-xs font-medium uppercase tracking-wider ${
                      image ? 'text-white' : 'text-brand-500'
                    }`}
                  >
                    Shop now &rarr;
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ErrorState />
      )}
    </section>
  );
}

/** Only statements true of the current ordering flow. */
const PROMISES = [
  {
    title: 'Pay your way',
    text: 'Pay with bKash or Nagad, then submit your transaction ID on the order page.',
  },
  {
    title: 'No surprise charges',
    text: 'Your delivery charge and final total are shown at checkout before you order.',
  },
  {
    title: 'Always know where it is',
    text: 'Follow every order from payment check to delivery in your account.',
  },
];

function WhyBrothers() {
  return (
    <section className="mt-16 bg-brand-950 text-white sm:mt-24">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-4xl font-semibold uppercase sm:text-5xl">Why {store.name}</h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-3">
          {PROMISES.map((item) => (
            <li key={item.title} className="border-t border-white/25 pt-5">
              <h3 className="text-2xl font-semibold uppercase">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-200">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [categories, newest, bestSellers, featured, deals] = await Promise.all([
    load(getCategories()),
    loadProducts({ newArrival: true }),
    loadProducts({ bestSeller: true }),
    loadProducts({ featured: true }),
    loadProducts({ sort: 'discount' }),
  ]);

  // The "discount" sort puts discounted items first; keep only items that really have a discount.
  const offers: Loaded<ProductListItem[]> = deals.ok
    ? { ok: true, data: deals.data.filter((product) => product.discountPercent > 0) }
    : deals;

  return (
    <main>
      <HomeHero />
      <ProductSection title="New arrivals" href="/products?newArrival=true" result={newest} />
      <CategorySection result={categories} />
      <ProductSection title="Best sellers" href="/products?bestSeller=true" result={bestSellers} />
      <ProductSection title="Featured" href="/products?featured=true" result={featured} />
      <ProductSection title="Special offers" href="/products?sort=discount" result={offers} />
      <WhyBrothers />
    </main>
  );
}
