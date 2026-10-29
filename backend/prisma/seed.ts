/* Phase 2 seed. Idempotent: safe to run repeatedly; never overwrites existing rows.
 *
 * Required env (backend/.env):
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (min 12 chars)
 * Optional env:
 *   SEED_ADMIN_NAME, BKASH_NUMBER, NAGAD_NUMBER
 *
 * Sample categories/products are skipped when NODE_ENV=production.
 */
import { PrismaClient, ProductStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Add it to backend/.env`);
  }
  return value;
}

async function seedAdmin(): Promise<void> {
  const email = requireEnv('SEED_ADMIN_EMAIL').trim().toLowerCase();
  const password = requireEnv('SEED_ADMIN_PASSWORD');
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  }
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Store Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists - left unchanged.');
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.create({
    data: { name, email, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  console.log(`Admin user created (${email}).`);
}

async function seedSettings(): Promise<void> {
  const settings: Record<string, unknown> = {
    'payment.bkashNumber': process.env.BKASH_NUMBER || '01XXXXXXXXX',
    'payment.nagadNumber': process.env.NAGAD_NUMBER || '01XXXXXXXXX',
    'payment.screenshotEnabled': true,
    'payment.maxAttempts': 3,
    'order.unpaidExpiryHours': 24,
    // Placeholders - real values to be supplied by the business owner.
    'delivery.homeCity': 'Dhaka',
    'delivery.homeCityCharge': 60,
    'delivery.otherCityCharge': 120,
    'delivery.freeThreshold': null,
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }
  console.log(`Settings ensured (${Object.keys(settings).length} keys).`);
}

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', description: 'Phones, audio and gadgets.', sortOrder: 1 },
  { name: 'Fashion', slug: 'fashion', description: 'Clothing and accessories.', sortOrder: 2 },
  { name: 'Home & Living', slug: 'home-living', description: 'Everything for your home.', sortOrder: 3 },
  { name: 'Beauty & Care', slug: 'beauty-care', description: 'Skincare and personal care.', sortOrder: 4 },
  { name: 'Groceries', slug: 'groceries', description: 'Daily essentials.', sortOrder: 5 },
];

interface SampleProduct {
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
}

const PRODUCTS: SampleProduct[] = [
  { category: 'electronics', name: 'Wireless Headphone X100', slug: 'wireless-headphone-x100', sku: 'ELEC-001', price: 3500, discountPrice: 2990, stock: 40, featured: true, soldCount: 120 },
  { category: 'electronics', name: 'Bluetooth Speaker Mini', slug: 'bluetooth-speaker-mini', sku: 'ELEC-002', price: 2200, stock: 25, soldCount: 64 },
  { category: 'electronics', name: 'Fast Charger 30W', slug: 'fast-charger-30w', sku: 'ELEC-003', price: 1200, discountPrice: 990, stock: 3, lowStock: 5, soldCount: 210 },
  { category: 'fashion', name: 'Classic Cotton T-Shirt', slug: 'classic-cotton-t-shirt', sku: 'FASH-001', price: 850, stock: 100, featured: true, soldCount: 300 },
  { category: 'fashion', name: 'Slim Fit Denim Jeans', slug: 'slim-fit-denim-jeans', sku: 'FASH-002', price: 2400, discountPrice: 1900, stock: 45, soldCount: 88 },
  { category: 'fashion', name: 'Leather Wallet', slug: 'leather-wallet', sku: 'FASH-003', price: 1500, stock: 0, soldCount: 55 },
  { category: 'home-living', name: 'Ceramic Coffee Mug Set', slug: 'ceramic-coffee-mug-set', sku: 'HOME-001', price: 1300, stock: 60, featured: true, soldCount: 40 },
  { category: 'home-living', name: 'LED Desk Lamp', slug: 'led-desk-lamp', sku: 'HOME-002', price: 1800, discountPrice: 1500, stock: 30, soldCount: 72 },
  { category: 'beauty-care', name: 'Vitamin C Face Serum', slug: 'vitamin-c-face-serum', sku: 'BEAU-001', price: 1600, discountPrice: 1250, stock: 50, featured: true, soldCount: 95 },
  { category: 'beauty-care', name: 'Herbal Shampoo 400ml', slug: 'herbal-shampoo-400ml', sku: 'BEAU-002', price: 450, stock: 80, soldCount: 150 },
  { category: 'groceries', name: 'Premium Basmati Rice 5kg', slug: 'premium-basmati-rice-5kg', sku: 'GROC-001', price: 980, stock: 200, soldCount: 410 },
  { category: 'groceries', name: 'Discontinued Sample Item', slug: 'discontinued-sample-item', sku: 'GROC-999', price: 100, stock: 0, status: 'INACTIVE' },
];

async function seedCatalog(): Promise<void> {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, status: 'ACTIVE' },
    });
  }

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

  for (const p of PRODUCTS) {
    const catId = categoryId.get(p.category);
    if (!catId) throw new Error(`Unknown category slug: ${p.category}`);

    const discountPercent = p.discountPrice
      ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
      : 0;

    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        categoryId: catId,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        shortDescription: `${p.name} - sample product for development.`,
        description: `${p.name}. This is sample seed data used for development and testing.`,
        price: p.price.toFixed(2),
        discountPrice: p.discountPrice ? p.discountPrice.toFixed(2) : null,
        discountPercent,
        stockQuantity: p.stock,
        lowStockThreshold: p.lowStock ?? 5,
        status: p.status ?? 'ACTIVE',
        featured: p.featured ?? false,
        soldCount: p.soldCount ?? 0,
      },
    });
  }
  console.log(`Sample catalog ensured (${CATEGORIES.length} categories, ${PRODUCTS.length} products).`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedSettings();
  if (process.env.NODE_ENV === 'production') {
    console.log('NODE_ENV=production - skipping sample categories/products.');
  } else {
    await seedCatalog();
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });