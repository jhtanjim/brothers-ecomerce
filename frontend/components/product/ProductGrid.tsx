import { ProductCard } from '@/components/product/ProductCard';
import type { ProductListItem } from '@/lib/api/types';

interface ProductGridProps {
  products: ProductListItem[];
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
      {products.map((product) => (
        <li key={product.id} className="flex">
          <div className="flex w-full">
            <ProductCard product={product} />
          </div>
        </li>
      ))}
    </ul>
  );
}
