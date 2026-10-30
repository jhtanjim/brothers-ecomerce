import type { Metadata, Viewport } from 'next';
import {
  DM_Sans,
  Figtree,
  Inter,
  Noto_Sans_Bengali,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google';
import type { CSSProperties, ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { CartProvider } from '@/components/cart/CartProvider';
import { SITE_NAME, getSiteUrl } from '@/lib/format';
import { store, storeCssVariables } from '@/lib/store';
import './globals.css';

const DESCRIPTION = store.description;

// Self-hosted by next/font at build time (no request to Google from the visitor's browser).
// Each store's pair is declared here because next/font needs literal calls at module scope.
const catalogSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: false,
});
const catalogDisplay = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  preload: false,
});
const editorialSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: false,
});
const editorialDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  preload: false,
});
const pharmacySans = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: false,
});
const pharmacyDisplay = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  preload: false,
});
const fonts = {
  catalog: [catalogSans, catalogDisplay],
  editorial: [editorialSans, editorialDisplay],
  pharmacy: [pharmacySans, pharmacyDisplay],
}[store.layout];

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
    <html
      lang="en"
      className={`${fonts[0].variable} ${fonts[1].variable} ${bengali.variable}`}
      style={storeCssVariables() as CSSProperties}
    >
      <body className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
