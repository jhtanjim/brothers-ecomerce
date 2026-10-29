import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/api/products';
import { getSiteUrl } from '@/lib/format';

/** Rebuild the sitemap at most once an hour. */
export const revalidate = 3600;

const PAGE_SIZE = 100; // API maximum
const MAX_PAGES = 500; // 500 x 100 = 50,000 URLs, the limit for a single sitemap file

/** Reads product slugs page by page. A failure returns what was collected so far. */
async function loadProductSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { items, meta } = await getProducts({ page, limit: PAGE_SIZE });
      slugs.push(...items.map((item) => item.slug));
      if (page >= meta.totalPages) break;
    }
  } catch {
    // A shorter sitemap is better than a broken one.
  }
  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const slugs = await loadProductSlugs();

  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.8 },
    ...slugs.map((slug) => ({
      url: `${base}/products/${encodeURIComponent(slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}