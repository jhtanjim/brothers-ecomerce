import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import type { ProductListItem } from '@/lib/api/types';

/** Storefront display rule only: the public API does not expose each product's own threshold. */
const LOW_STOCK_HINT_AT = 5;

interface ProductCardProps {
  product: ProductListItem;
}

/** Shown when a product has no image yet: calm and clearly intentional, never a broken image. */
function ImagePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-brand-100 text-brand-400">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
        aria-hidden="true"
      >
        <path d="M6 7h12l-1 13H7L6 7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      <span className="sr-only">{name}</span>
    </div>
  );
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.stockQuantity <= 0;
  const lowStock = !outOfStock && product.stockQuantity <= LOW_STOCK_HINT_AT;
  const hasDiscount = product.discountPrice !== null && product.discountPercent > 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex w-full flex-col overflow-hidden bg-white"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-brand-100">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition duration-300 group-hover:scale-[1.03] ${
              outOfStock ? 'opacity-60 grayscale' : ''
            }`}
          />
        ) : (
          <ImagePlaceholder name={product.name} />
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {outOfStock ? (
            <span className="bg-brand-950 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Sold out
            </span>
          ) : hasDiscount ? (
            <span className="bg-rose-700 px-2 py-1 text-xs font-semibold text-white">
              -{product.discountPercent}%
            </span>
          ) : null}
          {!outOfStock && product.newArrival ? (
            <span className="bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wider text-brand-950">
              New
            </span>
          ) : null}
          {!outOfStock && product.bestSeller ? (
            <span className="bg-accent px-2 py-1 text-xs font-semibold uppercase tracking-wider text-brand-950">
              Best seller
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <span className="text-xs font-medium uppercase tracking-wider text-brand-500">
          {product.category.name}
        </span>
        <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug text-slate-900 group-hover:underline sm:text-base">
          {product.name}
        </h3>
        <div className="mt-auto pt-2">
          <PriceDisplay
            price={product.price}
            discountPrice={product.discountPrice}
            discountPercent={product.discountPercent}
            showPercent={false}
          />
          {lowStock ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Only {product.stockQuantity} left
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
