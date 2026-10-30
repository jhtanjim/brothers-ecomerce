import Link from 'next/link';
import { getCategories } from '@/lib/api/categories';
import type { CategorySummary } from '@/lib/api/types';
import { SITE_NAME } from '@/lib/format';
import { store } from '@/lib/store';

const LINK_CLASS = 'inline-flex min-h-11 items-center hover:text-white';

/** The footer must never break the page if the API is down. */
async function loadCategories(): Promise<CategorySummary[]> {
  try {
    return await getCategories();
  } catch {
    return [];
  }
}

export async function Footer() {
  const categories = await loadCategories();
  const { phone, email, address, facebook, instagram } = store.contact;
  const hasContact = Boolean(phone || email || address || facebook || instagram);

  return (
    <footer className="mt-16 bg-brand-950 text-sm text-brand-200 sm:mt-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.25em] text-white">
            {SITE_NAME}
          </p>
          <p className="mt-3 max-w-xs leading-relaxed">{store.description}</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-lg font-semibold uppercase tracking-wider text-white">Shop</h2>
          <ul className="mt-2">
            <li>
              <Link href="/products?sort=newest" className={LINK_CLASS}>
                New arrivals
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className={LINK_CLASS}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <h2 className="text-lg font-semibold uppercase tracking-wider text-white">Account</h2>
          <ul className="mt-2">
            <li>
              <Link href="/account/orders" className={LINK_CLASS}>
                Track my orders
              </Link>
            </li>
            <li>
              <Link href="/account/addresses" className={LINK_CLASS}>
                My addresses
              </Link>
            </li>
            <li>
              <Link href="/cart" className={LINK_CLASS}>
                Cart
              </Link>
            </li>
          </ul>
        </nav>
        {hasContact ? (
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider text-white">Contact</h2>
            <ul className="mt-2">
              {phone ? (
                <li>
                  <a href={`tel:${phone}`} className={LINK_CLASS}>
                    {phone}
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className={LINK_CLASS}>
                    {email}
                  </a>
                </li>
              ) : null}
              {address ? <li className="py-2">{address}</li> : null}
              {facebook ? (
                <li>
                  <a href={facebook} rel="noopener noreferrer" className={LINK_CLASS}>
                    Facebook
                  </a>
                </li>
              ) : null}
              {instagram ? (
                <li>
                  <a href={instagram} rel="noopener noreferrer" className={LINK_CLASS}>
                    Instagram
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
