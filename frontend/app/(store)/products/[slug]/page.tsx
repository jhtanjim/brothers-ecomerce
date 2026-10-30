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
import { formatPrice, getSiteUrl } from '@/lib/format';

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
  const [label, className] =
    stockQuantity <= 0
      ? ['Out of stock', 'bg-rose-50 text-rose-700']
      : stockQuantity <= LOW_STOCK_NOTICE_AT
        ? [`Only ${stockQuantity} left in stock`, 'bg-amber-50 text-amber-800']
        : ['In stock', 'bg-emerald-50 text-emerald-700'];
  return (
    <p className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold ${className}`}>
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
      {label}
    </p>
  );
}

/** Only statements that are true for every order in the current (manual bKash/Nagad) workflow. */
const ORDER_INFO = [
  {
    title: 'Delivery',
    text: 'The delivery charge depends on your city and is shown at checkout before you order.',
  },
  {
    title: 'Payment',
    text: 'Pay with bKash or Nagad, then enter your transaction ID on the order page.',
  },
  {
    title: 'Order tracking',
    text: 'Follow your order from payment check to delivery in My orders. Unpaid orders are cancelled automatically after a while.',
  },
];

function OrderInfo() {
  return (
    <dl className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60">
      {ORDER_INFO.map((item) => (
        <div key={item.title} className="px-4 py-3">
          <dt className="text-sm font-semibold text-slate-900">{item.title}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
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
    const { items } = await getProducts({
      category: product.category.slug,
      limit: RELATED_COUNT + 1,
    });
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
  // Whole-taka strings from the API; the subtraction is display-only (the backend prices orders).
  const saving =
    product.discountPrice !== null && product.discountPercent > 0
      ? (Number(product.price) - Number(product.discountPrice)).toFixed(2)
      : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(product) }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="inline-flex min-h-11 items-center hover:text-brand-600">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/products?category=${encodeURIComponent(product.category.slug)}`}
              className="inline-flex min-h-11 items-center hover:text-brand-600"
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

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />

        <div>
          <Link
            href={`/products?category=${encodeURIComponent(product.category.slug)}`}
            className="text-sm font-semibold uppercase tracking-wide text-brand-700 hover:text-brand-800"
          >
            {product.category.name}
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">SKU: {product.sku}</p>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4 sm:p-5">
            <PriceDisplay
              size="lg"
              price={product.price}
              discountPrice={product.discountPrice}
              discountPercent={product.discountPercent}
            />
            {saving ? (
              <p className="mt-1 text-sm font-medium text-rose-600">
                You save {formatPrice(saving)}
              </p>
            ) : null}
            <div className="mt-3">
              <StockStatus stockQuantity={product.stockQuantity} />
            </div>

            <AddToCartButton
              productId={product.id}
              slug={product.slug}
              stockQuantity={product.stockQuantity}
              variants={product.variants}
            />
          </div>

          {product.material ? (
            <p className="mt-6 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Material:</span> {product.material}
            </p>
          ) : null}

          {product.shortDescription && (
            <p className="mt-6 text-base leading-relaxed text-slate-700">
              {product.shortDescription}
            </p>
          )}

          <OrderInfo />

          {product.description && (
            <section className="mt-8 border-t border-slate-200 pt-6" aria-label="Description">
              <h2 className="text-lg font-semibold text-slate-900">Description</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">
                {product.description}
              </p>
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
