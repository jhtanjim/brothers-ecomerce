import Image from 'next/image';
import Link from 'next/link';
import { store } from '@/lib/store';

/** Full-width campaign area. Works as pure type until a campaign photo is set in lib/store.ts. */
export function HomeHero() {
  const { eyebrow, title, text, image } = store.hero;
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 text-white">
      {image ? (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[60%_top] sm:object-[100%_20%]"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-950/90 via-brand-950/50 to-transparent lg:bg-gradient-to-r"
            aria-hidden="true"
          />
        </>
      ) : null}
      <div className="mx-auto flex min-h-[85vh] max-w-7xl sm:min-h-[70vh] flex-col justify-end px-4 pb-14 pt-24 sm:px-6 sm:pb-20 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
        <h1 className="mt-4 max-w-md text-6xl font-semibold uppercase leading-[0.95] sm:text-7xl lg:max-w-xl lg:text-8xl">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-brand-200 sm:text-lg">{text}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/products?newArrival=true"
            className="inline-flex h-12 items-center bg-white px-8 text-sm font-semibold uppercase tracking-wider text-brand-950 hover:bg-brand-100"
          >
            Shop new arrivals
          </Link>
          <Link
            href="/products"
            className="inline-flex h-12 items-center border border-white/50 px-8 text-sm font-semibold uppercase tracking-wider text-white hover:border-white"
          >
            View everything
          </Link>
        </div>
      </div>
    </section>
  );
}
