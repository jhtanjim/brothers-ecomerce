import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AdminOrdersService } from '../orders/admin-orders.service';
import { OrderCancellationService } from '../orders/order-cancellation.service';
import { OrdersService } from '../orders/orders.service';
import { PosService } from '../orders/pos.service';
import { ReturnsService } from '../orders/returns.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { averageCostCents, PurchasesService } from './purchases.service';

describe('averageCostCents', () => {
  it('blends new stock with what is on hand', () => {
    expect(averageCostCents(10, 10000, 10, 20000)).toBe(15000);
  });

  it('uses the new price when nothing is known about the old stock', () => {
    expect(averageCostCents(10, null, 5, 20000)).toBe(20000);
    expect(averageCostCents(0, 10000, 5, 20000)).toBe(20000);
  });
});

describe('stock purchases and profit (integration)', () => {
  let prisma: PrismaClient;
  let purchases: PurchasesService;
  let pos: PosService;
  let returns: ReturnsService;
  let dashboard: DashboardService;
  let adminId: string;
  let shirt: string;
  let medium: string;
  let watch: string;

  const product = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } });
  const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const buy = (items: object[], key: string = randomUUID()) =>
    purchases.create(adminId, { supplierName: 'Mirpur Traders', items } as never, key, null);

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const logs = new ActivityLogsService();
    const cancellation = new OrderCancellationService();
    const orders = new OrdersService(
      service,
      new SettingsService(service),
      {} as CloudinaryService,
      cancellation,
    );
    purchases = new PurchasesService(service, logs);
    pos = new PosService(
      service,
      orders,
      new AdminOrdersService(service, cancellation, logs),
      cancellation,
      logs,
    );
    returns = new ReturnsService(service, logs);
    dashboard = new DashboardService(service);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminId = (
      await prisma.user.create({
        data: { name: 'Admin', email: 'a@example.com', passwordHash: 'x', role: 'ADMIN' },
      })
    ).id;
    const categoryId = (await prisma.category.create({ data: { name: 'C', slug: 'c' } })).id;
    const row = await prisma.product.create({
      data: {
        categoryId,
        name: 'Shirt',
        slug: 'shirt',
        sku: 'S-1',
        price: '1000',
        stockQuantity: 0,
        variants: { create: { size: 'M', sku: 'S-1-M', stockQuantity: 0 } },
      },
      include: { variants: true },
    });
    shirt = row.id;
    medium = row.variants[0]!.id;
    watch = (
      await prisma.product.create({
        data: {
          categoryId,
          name: 'Watch',
          slug: 'watch',
          sku: 'W-1',
          price: '500',
          stockQuantity: 0,
        },
      })
    ).id;
  });

  it('adds stock, keeps the option total right, and averages the buying price', async () => {
    const first = await buy([{ productId: shirt, variantId: medium, quantity: 10, unitCost: 400 }]);
    expect(first.totalCost).toBe('4000.00');
    expect(first.purchaseNumber.startsWith('PUR-')).toBe(true);

    await buy([{ productId: shirt, variantId: medium, quantity: 10, unitCost: 600 }]);
    const row = await product(shirt);
    expect(row.stockQuantity).toBe(20);
    expect(row.costPrice?.toString()).toBe('500');
    expect(
      (await prisma.productVariant.findUniqueOrThrow({ where: { id: medium } })).stockQuantity,
    ).toBe(20);
  });

  it('does not add stock twice for a repeated submit', async () => {
    const key = randomUUID();
    const items = [{ productId: watch, quantity: 5, unitCost: 100 }];
    const first = await buy(items, key);
    const second = await buy(items, key);
    expect(second.id).toBe(first.id);
    expect((await product(watch)).stockQuantity).toBe(5);
  });

  it('refuses a missing option, and changes nothing when one line fails', async () => {
    await expect(buy([{ productId: shirt, quantity: 5, unitCost: 100 }])).rejects.toMatchObject({
      response: { code: 'OPTION_REQUIRED' },
    });
    await expect(
      buy([
        { productId: watch, quantity: 5, unitCost: 100 },
        { productId: 'zzz-missing', quantity: 1, unitCost: 100 },
      ]),
    ).rejects.toMatchObject({ response: { code: 'PRODUCT_NOT_FOUND' } });
    expect((await product(watch)).stockQuantity).toBe(0);
    expect(await prisma.stockPurchase.count()).toBe(0);
  });

  it('keeps cost when a later purchase changes the price, and reports profit', async () => {
    await buy([{ productId: watch, quantity: 5, unitCost: 200 }]);
    await pos.createSale(
      adminId,
      { items: [{ productId: watch, quantity: 2 }], paymentMethod: 'CASH', cashReceived: 1000 },
      randomUUID(),
    );
    await buy([{ productId: watch, quantity: 3, unitCost: 400 }]);

    const report = await dashboard.dailyReport(today());
    expect(report.profit).toEqual({
      revenue: '1000.00',
      cost: '400.00',
      profit: '600.00',
      unknownCostUnits: 0,
    });
    expect(report.purchases).toEqual({ count: 2, total: '2200.00' });
  });

  it('shares a sale discount in profit, and leaves out items with no known cost', async () => {
    await buy([{ productId: watch, quantity: 2, unitCost: 200 }]);
    await prisma.product.update({ where: { id: shirt }, data: { stockQuantity: 1 } });
    await prisma.productVariant.update({ where: { id: medium }, data: { stockQuantity: 1 } });
    await pos.createSale(
      adminId,
      {
        items: [
          { productId: watch, quantity: 1 },
          { productId: shirt, variantId: medium, quantity: 1 },
        ],
        discount: 150,
        paymentMethod: 'CASH',
        cashReceived: 1350,
      },
      randomUUID(),
    );
    const report = await dashboard.dailyReport(today());
    // The watch is a third of the sale, so it carries 50 of the 150 discount: 450 - 200.
    expect(report.profit).toEqual({
      revenue: '450.00',
      cost: '200.00',
      profit: '250.00',
      unknownCostUnits: 1,
    });
  });

  it('takes returns out of profit, counting damaged items as a loss', async () => {
    await buy([{ productId: watch, quantity: 4, unitCost: 200 }]);
    const sale = await pos.createSale(
      adminId,
      { items: [{ productId: watch, quantity: 3 }], paymentMethod: 'CASH', cashReceived: 1500 },
      randomUUID(),
    );
    const itemId = sale.items[0]!.id;
    const give = (restock: boolean) =>
      returns.create(
        adminId,
        sale.id,
        {
          items: [{ orderItemId: itemId, quantity: 1 }],
          reason: 'Faulty',
          restock,
          refundMethod: 'CASH',
        },
        randomUUID(),
        null,
      );

    await give(true);
    expect((await dashboard.dailyReport(today())).profit).toMatchObject({
      revenue: '1000.00',
      cost: '400.00',
      profit: '600.00',
    });

    // Refunded but not sellable again: the buying price is lost.
    await give(false);
    expect((await dashboard.dailyReport(today())).profit).toMatchObject({
      revenue: '500.00',
      cost: '400.00',
      profit: '100.00',
    });
  });

  it('never sends the buying price to customers', async () => {
    await buy([{ productId: watch, quantity: 1, unitCost: 200 }]);
    const service = new ProductsService(
      prisma as unknown as PrismaService,
      {} as CloudinaryService,
    );
    const detail = await service.findBySlugPublic('watch');
    expect(detail).not.toHaveProperty('costPrice');
    expect((await service.findOneAdmin(watch)).costPrice?.toString()).toBe('200');
  });
});
