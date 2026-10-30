/* Development sample data for BROTHERS. Never loaded in production (see seed.ts).
 * Prices and stock are invented; photos live in frontend/public/brand and are stock images. */
import type { ProductStatus } from '@prisma/client';

export const CATEGORIES = [
  { name: 'Shirts', slug: 'shirts', image: 'shirts', sortOrder: 1 },
  { name: 'T-Shirts', slug: 't-shirts', image: 'tee', sortOrder: 2 },
  { name: 'Polos', slug: 'polos', image: 'polo', sortOrder: 3 },
  { name: 'Panjabi', slug: 'panjabi', image: 'panjabi', sortOrder: 4 },
  { name: 'Pants & Jeans', slug: 'pants-jeans', image: 'jeans', sortOrder: 5 },
  { name: 'Shoes', slug: 'shoes', image: 'shoes', sortOrder: 6 },
  { name: 'Watches', slug: 'watches', image: 'watch', sortOrder: 7 },
  { name: 'Wallets & Belts', slug: 'wallets-belts', image: 'wallet', sortOrder: 8 },
];

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
  soldCount?: number;
  status?: ProductStatus;
  image: string;
}

export const PRODUCTS: SampleProduct[] = [
  {
    category: 'shirts',
    name: 'Oxford Formal Shirt',
    slug: 'oxford-formal-shirt',
    sku: 'SHRT-001',
    price: 1850,
    discountPrice: 1550,
    stock: 40,
    featured: true,
    image: 'shirts',
  },
  {
    category: 't-shirts',
    name: 'Classic Cotton T-Shirt',
    slug: 'classic-cotton-t-shirt',
    sku: 'FASH-001',
    price: 850,
    stock: 100,
    featured: true,
    image: 'tee',
  },
  {
    category: 'polos',
    name: 'Classic Polo Shirt',
    slug: 'classic-polo-shirt',
    sku: 'POLO-001',
    price: 1250,
    stock: 60,
    featured: true,
    image: 'polo',
  },
  {
    category: 'panjabi',
    name: 'Classic White Panjabi',
    slug: 'classic-white-panjabi',
    sku: 'PANJ-001',
    price: 2600,
    discountPrice: 2200,
    stock: 30,
    featured: true,
    image: 'panjabi',
  },
  {
    category: 'pants-jeans',
    name: 'Slim Fit Denim Jeans',
    slug: 'slim-fit-denim-jeans',
    sku: 'FASH-002',
    price: 2400,
    discountPrice: 1900,
    stock: 45,
    image: 'jeans',
  },
  {
    category: 'shoes',
    name: 'Brown Leather Lace-Up Shoes',
    slug: 'brown-leather-lace-up-shoes',
    sku: 'SHOE-001',
    price: 4800,
    stock: 18,
    image: 'shoes',
  },
  {
    category: 'watches',
    name: 'Minimal Leather Strap Watch',
    slug: 'minimal-leather-strap-watch',
    sku: 'WTCH-001',
    price: 3200,
    discountPrice: 2750,
    stock: 3,
    image: 'watch',
  },
  {
    category: 'wallets-belts',
    name: 'Leather Wallet',
    slug: 'leather-wallet',
    sku: 'FASH-003',
    price: 1500,
    stock: 0,
    image: 'wallet',
  },
];

export const imageUrl = (image: string): string => `/brand/products/${image}.jpg`;
