import type { Metadata, Viewport } from 'next';
import { Archivo, Barlow_Condensed, Noto_Sans_Bengali } from 'next/font/google';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { CartProvider } from '@/components/cart/CartProvider';
import { SITE_NAME, getSiteUrl } from '@/lib/format';
import { store } from '@/lib/store';
import './globals.css';

const DESCRIPTION = store.description;

// Self-hosted by next/font at build time (no request to Google from the visitor's browser).
const sans = Archivo({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const heading = Barlow_Condensed({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600'],
  variable: '--font-display',
});

// Fallback for the Taka sign (U+09F3) and any Bangla text: the Latin font has no Bengali glyphs.
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  display: 'swap',
  variable: '--font-bengali',
});

export const viewport: Viewport = {
  themeColor: store.themeColor,
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${heading.variable} ${bengali.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
