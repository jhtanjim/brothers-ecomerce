import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import type { ProductListItem } from '@/lib/api/types';
import { store } from '@/lib/store';

/** Gadgets: dark panel with live products beside the pitch. */
function CatalogHero({ picks }: { picks: ProductListItem[] }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-brand-950 px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-brand-300">{store.hero.eyebrow}</p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            {store.hero.title}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-brand-100 sm:text-lg">
            {store.hero.text}
          </p>
          <Link
            href="/products"
            className="mt-8 inline-flex h-12 items-center rounded-lg bg-white px-7 text-sm font-semibold text-brand-900 hover:bg-brand-50"
          >
            {store.hero.cta}
          </Link>
        </div>
        {picks.length > 0 ? (
          <ul className="grid gap-3">
            {picks.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  className="flex items-center gap-3 rounded-xl bg-white p-3 text-slate-900 hover:bg-brand-50"
                >
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {product.primaryImage ? (
                      <Image
                        src={product.primaryImage.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {product.name}
                  </span>
                  <PriceDisplay
                    price={product.price}
                    discountPrice={product.discountPrice}
                    discountPercent={product.discountPercent}
                    showPercent={false}
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** Clothing: quiet, centred, magazine-style headline. */
function EditorialHero() {
  return (
    <section className="border-b border-brand-200 bg-brand-50 px-6 py-16 text-center sm:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
        {store.hero.eyebrow}
      </p>
      <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-medium leading-tight text-slate-900 sm:text-6xl">
        {store.hero.title}
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
        {store.hero.text}
      </p>
      <Link
        href="/products"
        className="mt-9 inline-flex h-12 items-center border border-slate-900 px-9 text-sm font-semibold uppercase tracking-wider text-slate-900 hover:bg-slate-900 hover:text-white"
      >
        {store.hero.cta}
      </Link>
    </section>
  );
}

/** Pharmacy: search first, because customers usually know the medicine they need. */
function PharmacyHero() {
  return (
    <section className="rounded-2xl bg-brand-700 px-6 py-10 text-white sm:px-10 sm:py-14">
      <p className="text-sm font-semibold text-brand-100">{store.hero.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{store.hero.title}</h1>
      <p className="mt-3 max-w-2xl text-base text-brand-50 sm:text-lg">{store.hero.text}</p>
      <form action="/products" method="get" role="search" className="mt-7 flex max-w-2xl gap-2">
        <label htmlFor="medicineSearch" className="sr-only">
          Search by medicine name
        </label>
        <input
          id="medicineSearch"
          type="search"
          name="search"
          maxLength={100}
          placeholder="Search by medicine name"
          className="h-12 min-w-0 flex-1 rounded-lg border-0 px-4 text-base text-slate-900 outline-none focus:ring-4 focus:ring-brand-300"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-lg bg-brand-950 px-6 text-sm font-semibold text-white hover:bg-brand-900"
        >
          Search
        </button>
      </form>
      <Link
        href="/products"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-white underline"
      >
        {store.hero.cta}
      </Link>
    </section>
  );
}

export function StoreHero({ picks }: { picks: ProductListItem[] }) {
  if (store.layout === 'editorial') return <EditorialHero />;
  if (store.layout === 'pharmacy') return <PharmacyHero />;
  return <CatalogHero picks={picks} />;
}
