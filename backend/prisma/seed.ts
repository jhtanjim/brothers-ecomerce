/* Phase 2 seed. Idempotent: safe to run repeatedly; never overwrites existing rows.
 *
 * Required env (backend/.env):
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (min 12 chars)
 * Optional env:
 *   SEED_ADMIN_NAME, BKASH_NUMBER, NAGAD_NUMBER
 *
 * Sample categories/products are skipped when NODE_ENV=production.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { CATEGORIES, PRODUCTS, imageUrl, totalStock, variantSku } from './sample-catalog';

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

async function seedCatalog(): Promise<void> {
  // Parents first, so subcategories can point at them.
  for (const { image, parent, ...c } of [...CATEGORIES].sort(
    (x, y) => Number(Boolean(x.parent)) - Number(Boolean(y.parent)),
  )) {
    const parentRow = parent
      ? await prisma.category.findUniqueOrThrow({ where: { slug: parent } })
      : null;
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, imageUrl: imageUrl(image), parentId: parentRow?.id, status: 'ACTIVE' },
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
        stockQuantity: totalStock(p),
        lowStockThreshold: p.lowStock ?? 5,
        status: p.status ?? 'ACTIVE',
        featured: p.featured ?? false,
        newArrival: p.newArrival ?? false,
        bestSeller: p.bestSeller ?? false,
        material: p.material ?? null,
        soldCount: p.soldCount ?? 0,
        images: {
          create: { url: imageUrl(p.image), publicId: `sample/${p.image}`, isPrimary: true },
        },
        variants: {
          create: (p.variants ?? []).map((variant) => ({
            size: variant.size ?? '',
            color: variant.color ?? '',
            sku: variantSku(p.sku, variant),
            stockQuantity: variant.stock,
          })),
        },
      },
    });
  }
  console.log(
    `Sample catalog ensured (${CATEGORIES.length} categories, ${PRODUCTS.length} products).`,
  );
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
