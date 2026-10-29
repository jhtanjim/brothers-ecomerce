import Image from 'next/image';
import Link from 'next/link';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import type { ProductListItem } from '@/lib/api/types';

interface ProductCardProps {
  product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.stockQuantity <= 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}
        {outOfStock && (
          <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs font-medium text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <span className="text-xs uppercase tracking-wide text-slate-500">{product.category.name}</span>
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 sm:text-base">{product.name}</h3>
        <div className="mt-auto pt-2">
          <PriceDisplay
            price={product.price}
            discountPrice={product.discountPrice}
            discountPercent={product.discountPercent}
          />
        </div>
      </div>
    </Link>
  );
}