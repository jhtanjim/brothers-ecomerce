/**
 * Store profiles: everything that makes one deployment a different shop. One codebase runs many
 * stores; each deployment sets NEXT_PUBLIC_STORE_ID and has its own API and database (D36).
 * Hero wording is draft copy for the owner to review.
 */
export type StoreLayout = 'catalog' | 'editorial' | 'pharmacy';

/** Space-separated RGB channels, so Tailwind opacity modifiers keep working. */
type Palette = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

export interface StoreProfile {
  id: string;
  name: string;
  description: string;
  /** Picks the home page and product card designs. */
  layout: StoreLayout;
  /** Browser UI colour on phones (usually palette 700). */
  themeColor: string;
  palette: Palette;
  hero: { eyebrow: string; title: string; text: string; cta: string };
}

const STORES: Record<string, StoreProfile> = {
  geton: {
    id: 'geton',
    name: 'Geton',
    description: 'Phones, audio and everyday gadgets. Order online and pay with bKash or Nagad.',
    layout: 'catalog',
    themeColor: '#1d4ed8',
    palette: {
      50: '239 246 255',
      100: '219 234 254',
      200: '191 219 254',
      300: '147 197 253',
      400: '96 165 250',
      500: '59 130 246',
      600: '37 99 235',
      700: '29 78 216',
      800: '30 64 175',
      900: '30 58 138',
      950: '23 37 84',
    },
    hero: {
      eyebrow: 'Gadgets and electronics',
      title: 'The tech you want, without the runaround',
      text: 'Compare prices, check what is in stock and order in minutes. Pay with bKash or Nagad.',
      cta: 'Browse gadgets',
    },
  },
  iliyan: {
    id: 'iliyan',
    name: 'Iliyan',
    description: 'Clothing and accessories for men. Order online and pay with bKash or Nagad.',
    layout: 'editorial',
    themeColor: '#8b3e21',
    palette: {
      50: '253 246 241',
      100: '249 232 220',
      200: '242 208 184',
      300: '232 176 143',
      400: '219 135 93',
      500: '201 104 61',
      600: '168 78 42',
      700: '139 62 33',
      800: '112 51 30',
      900: '88 42 27',
      950: '50 22 12',
    },
    hero: {
      eyebrow: 'Menswear and accessories',
      title: 'Clothes you will reach for every day',
      text: 'Clothing and accessories for men. Order online and pay with bKash or Nagad.',
      cta: 'Shop the collection',
    },
  },
  shatkania: {
    id: 'shatkania',
    name: 'Shatkania Pharmacy',
    description: 'Medicines and health items. Order online and pay with bKash or Nagad.',
    layout: 'pharmacy',
    themeColor: '#0f766e',
    palette: {
      50: '240 253 250',
      100: '204 251 241',
      200: '153 246 228',
      300: '94 234 212',
      400: '45 212 191',
      500: '20 184 166',
      600: '13 148 136',
      700: '15 118 110',
      800: '17 94 89',
      900: '19 78 74',
      950: '4 47 46',
    },
    hero: {
      eyebrow: 'Medicines and health items',
      title: 'Find your medicine by name',
      text: 'Search our pharmacy, check what is in stock and order online. Pay with bKash or Nagad.',
      cta: 'Browse all items',
    },
  },
};

const DEFAULT_STORE_ID = 'geton';

function resolveStore(): StoreProfile {
  const id = process.env.NEXT_PUBLIC_STORE_ID || DEFAULT_STORE_ID;
  const profile = STORES[id];
  // Fail the build rather than launch a shop with the wrong brand.
  if (!profile) throw new Error(`Unknown NEXT_PUBLIC_STORE_ID "${id}"`);
  return profile;
}

export const store = resolveStore();

/** The palette as CSS variables for the <html> element; tailwind.config.ts reads them. */
export function storeCssVariables(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(store.palette).map(([shade, rgb]) => [`--brand-${shade}`, rgb]),
  );
}
