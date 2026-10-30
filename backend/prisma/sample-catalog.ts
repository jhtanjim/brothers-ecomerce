/* Development sample data for BROTHERS. Never loaded in production (see seed.ts).
 * Prices and stock are invented; photos live in frontend/public/brand and are stock images. */
import type { ProductStatus } from '@prisma/client';

export const CATEGORIES: {
  name: string;
  slug: string;
  image: string;
  sortOrder: number;
  parent?: string;
}[] = [
  { name: 'Shirts', slug: 'shirts', image: 'shirts', sortOrder: 1 },
  { name: 'Formal Shirts', slug: 'formal-shirts', image: 'shirts', sortOrder: 1, parent: 'shirts' },
  { name: 'T-Shirts', slug: 't-shirts', image: 'tee', sortOrder: 2 },
  { name: 'Polos', slug: 'polos', image: 'polo', sortOrder: 3 },
  { name: 'Panjabi', slug: 'panjabi', image: 'panjabi', sortOrder: 4 },
  { name: 'Pants & Jeans', slug: 'pants-jeans', image: 'jeans', sortOrder: 5 },
  { name: 'Jeans', slug: 'jeans', image: 'jeans', sortOrder: 1, parent: 'pants-jeans' },
  { name: 'Shoes', slug: 'shoes', image: 'shoes', sortOrder: 6 },
  { name: 'Watches', slug: 'watches', image: 'watch', sortOrder: 7 },
  { name: 'Wallets & Belts', slug: 'wallets-belts', image: 'wallet', sortOrder: 8 },
];

export interface SampleVariant {
  size?: string;
  color?: string;
  stock: number;
}

export interface SampleProduct {
  category: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  discountPrice?: number;
  stock: number;
  lowStock?: number;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  material?: string;
  soldCount?: number;
  status?: ProductStatus;
  image: string;
  /** When set, stock is the sum of these. */
  variants?: SampleVariant[];
}

const sized = (sizes: string[], color: string, stock: number): SampleVariant[] =>
  sizes.map((size) => ({ size, color, stock }));

export const PRODUCTS: SampleProduct[] = [
  {
    category: 'formal-shirts',
    name: 'Oxford Formal Shirt',
    slug: 'oxford-formal-shirt',
    sku: 'SHRT-001',
    price: 1850,
    discountPrice: 1550,
    stock: 0,
    featured: true,
    newArrival: true,
    material: 'Cotton',
    image: 'shirts',
    variants: [...sized(['M', 'L', 'XL'], 'White', 6), ...sized(['M', 'L'], 'Sky Blue', 4)],
  },
  {
    category: 't-shirts',
    name: 'Classic Cotton T-Shirt',
    slug: 'classic-cotton-t-shirt',
    sku: 'FASH-001',
    price: 850,
    stock: 0,
    featured: true,
    bestSeller: true,
    material: 'Cotton',
    image: 'tee',
    variants: sized(['S', 'M', 'L', 'XL'], 'White', 12),
  },
  {
    category: 'polos',
    name: 'Classic Polo Shirt',
    slug: 'classic-polo-shirt',
    sku: 'POLO-001',
    price: 1250,
    stock: 0,
    featured: true,
    newArrival: true,
    material: 'Cotton Pique',
    image: 'polo',
    variants: sized(['M', 'L', 'XL'], 'White', 8),
  },
  {
    category: 'panjabi',
    name: 'Classic White Panjabi',
    slug: 'classic-white-panjabi',
    sku: 'PANJ-001',
    price: 2600,
    discountPrice: 2200,
    stock: 0,
    featured: true,
    bestSeller: true,
    material: 'Cotton',
    image: 'panjabi',
    variants: sized(['40', '42', '44'], 'White', 5),
  },
  {
    category: 'jeans',
    name: 'Slim Fit Denim Jeans',
    slug: 'slim-fit-denim-jeans',
    sku: 'FASH-002',
    price: 2400,
    discountPrice: 1900,
    stock: 0,
    bestSeller: true,
    material: 'Denim',
    image: 'jeans',
    variants: sized(['30', '32', '34', '36'], 'Blue', 7),
  },
  {
    category: 'shoes',
    name: 'Brown Leather Lace-Up Shoes',
    slug: 'brown-leather-lace-up-shoes',
    sku: 'SHOE-001',
    price: 4800,
    stock: 0,
    newArrival: true,
    material: 'Leather',
    image: 'shoes',
    variants: sized(['40', '41', '42', '43'], 'Brown', 3),
  },
  {
    category: 'watches',
    name: 'Minimal Leather Strap Watch',
    slug: 'minimal-leather-strap-watch',
    sku: 'WTCH-001',
    price: 3200,
    discountPrice: 2750,
    stock: 3,
    newArrival: true,
    image: 'watch',
  },
  {
    category: 'wallets-belts',
    name: 'Leather Wallet',
    slug: 'leather-wallet',
    sku: 'FASH-003',
    price: 1500,
    stock: 0,
    material: 'Leather',
    image: 'wallet',
  },
];

export const imageUrl = (image: string): string => `/brand/products/${image}.jpg`;

export const variantSku = (sku: string, variant: SampleVariant): string =>
  [sku, variant.size, variant.color]
    .filter(Boolean)
    .join('-')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-');

export const totalStock = (product: SampleProduct): number =>
  product.variants
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : product.stock;
