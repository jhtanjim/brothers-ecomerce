import Link from 'next/link';
import { SITE_NAME } from '@/lib/format';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <nav aria-label="Footer">
          <ul className="flex gap-5">
            <li>
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-brand-600">
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center hover:text-brand-600"
              >
                Products
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
