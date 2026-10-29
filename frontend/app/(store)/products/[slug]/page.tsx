import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductGrid } from '@/components/product/ProductGrid';
import { PriceDisplay } from '@/components/product/PriceDisplay';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { getProductBySlug, getProducts } from '@/lib/api/products';
import type { ProductDetail, ProductListItem } from '@/lib/api/types';
import { getSiteUrl } from '@/lib/format';

const RELATED_COUNT = 4;
/** Show an "only N left" notice at or below this many units. */
const LOW_STOCK_NOTICE_AT = 5;
const META_DESCRIPTION_LENGTH = 160;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: 'Product not found', robots: { index: false, follow: false } };
  }

  const description =
    product.shortDescription ?? product.description?.slice(0, META_DESCRIPTION_LENGTH) ?? undefined;
  const image = product.images[0]?.url;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: `/products/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
  };
}

function StockStatus({ stockQuantity }: { stockQuantity: number }) {
  if (stockQuantity <= 0) {
    return <p className="text-sm font-medium text-rose-600">Out of stock</p>;
  }
  if (stockQuantity <= LOW_STOCK_NOTICE_AT) {
    return <p className="text-sm font-medium text-amber-600">Only {stockQuantity} left in stock</p>;
  }
  return <p className="text-sm font-medium text-emerald-600">In stock</p>;
}

function buildJsonLd(product: ProductDetail): string {
  const price = product.discountPrice ?? product.price;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description ?? undefined,
    category: product.category.name,
    image: product.images.length > 0 ? product.images.map((image) => image.url) : undefined,
    offers: {
      '@type': 'Offer',
      url: `${getSiteUrl()}/products/${product.slug}`,
      priceCurrency: 'BDT',
      price,
      availability:
        product.stockQuantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
  // Escape "<" so product text can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

async function loadRelated(product: ProductDetail): Promise<ProductListItem[]> {
  try {
    const { items } = await getProducts({ category: product.category.slug, limit: RELATED_COUNT + 1 });
    return items.filter((item) => item.id !== product.id).slice(0, RELATED_COUNT);
  } catch {
    // Related products are optional; never fail the page because of them.
    return [];
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await loadRelated(product);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildJsonLd(product) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="hover:text-indigo-600">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/products?category=${encodeURIComponent(product.category.slug)}`}
              className="hover:text-indigo-600"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-700">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{product.name}</h1>
          <p className="mt-1 text-sm text-slate-500">SKU: {product.sku}</p>

          <div className="mt-4">
            <PriceDisplay
              size="lg"
              price={product.price}
              discountPrice={product.discountPrice}
              discountPercent={product.discountPercent}
            />
          </div>

          <div className="mt-3">
            <StockStatus stockQuantity={product.stockQuantity} />
          </div>

          <AddToCartButton productId={product.id} slug={product.slug} stockQuantity={product.stockQuantity} />

          {product.shortDescription && (
            <p className="mt-6 text-slate-700">{product.shortDescription}</p>
          )}

          {product.description && (
            <section className="mt-8 border-t border-slate-200 pt-6" aria-label="Description">
              <h2 className="text-lg font-semibold text-slate-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-slate-700">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading
            title="Related products"
            href={`/products?category=${encodeURIComponent(product.category.slug)}`}
          />
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}