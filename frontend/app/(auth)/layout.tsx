import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

/** Storefront shell: skip link, header, page content, footer. */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* First focusable element: lets keyboard users jump past the header links. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-brand-800 focus:shadow-card"
      >
        Skip to content
      </a>
      <Header />
      <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </div>
      <Footer />
    </>
  );
}
