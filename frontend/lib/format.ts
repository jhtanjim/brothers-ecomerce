const DEFAULT_SITE_URL = 'http://localhost:3000';

export const SITE_NAME = 'E-Commerce Platform';

/** Bangladeshi taka sign, written as an escape so file encoding can never garble it. */
const TAKA = '\u09F3';

/** Formats a decimal string from the API (e.g. "980" or "1200.50") for display. */
export function formatPrice(value: string | number): string {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '';
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return `${TAKA}${amount.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  })}`;
}

/** Public site origin without a trailing slash. Used for metadata, sitemap and canonical URLs. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}
