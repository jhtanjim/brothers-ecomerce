import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/format';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas that arrive in later phases.
        disallow: ['/api/', '/admin', '/cart', '/checkout', '/account', '/login', '/register'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}