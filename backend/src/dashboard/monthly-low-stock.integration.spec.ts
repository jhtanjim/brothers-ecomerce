import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ExpensesService } from '../expenses/expenses.service';
import { AdminOrdersService } from '../orders/admin-orders.service';
import { OrderCancellationService } from '../orders/order-cancellation.service';
import { OrdersService } from '../orders/orders.service';
import { PosService } from '../orders/pos.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { DashboardService } from './dashboard.service';

describe('low stock by size and monthly totals (integration)', () => {
  let prisma: PrismaClient;
  let dashboard: DashboardService;
  let pos: PosService;
  let expenses: ExpensesService;
  let adminId: string;
  let categoryId: string;

  const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const logs = new ActivityLogsService();
    const cancellation = new OrderCancellationService();
    dashboard = new DashboardService(service);
    expenses = new ExpensesService(service, logs);
    pos = new PosService(
      service,
      new OrdersService(
        service,
        new SettingsService(service),
        {} as CloudinaryService,
        cancellation,
      ),
      new AdminOrdersService(service, cancellation, logs),
      cancellation,
      logs,
    );
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
    categoryId = (await prisma.category.create({ data: { name: 'C', slug: 'c' } })).id;
  });

  it('finds one size running out while the product total looks fine', async () => {
    await prisma.product.create({
      data: {
        categoryId,
        name: 'Polo',
        slug: 'polo',
        sku: 'P-1',
        price: '1000',
        stockQuantity: 22,
        lowStockThreshold: 5,
        variants: {
          create: [
            { size: 'M', color: 'White', sku: 'P-1-M', stockQuantity: 20 },
            { size: 'L', color: 'White', sku: 'P-1-L', stockQuantity: 2 },
          ],
        },
      },
    });
    await prisma.product.create({
      data: {
        categoryId,
        name: 'Watch',
        slug: 'watch',
        sku: 'W-1',
        price: '500',
        stockQuantity: 0,
      },
    });
    await prisma.product.create({
      data: {
        categoryId,
        name: 'Hidden',
        slug: 'hidden',
        sku: 'H-1',
        price: '500',
        stockQuantity: 0,
        status: 'INACTIVE',
      },
    });

    const list = await dashboard.lowStock();
    expect(list.map((row) => row.sku)).toEqual(['W-1', 'P-1-L']);
    expect(list[1]).toMatchObject({ size: 'L', color: 'White', stockQuantity: 2, name: 'Polo' });
    expect(list[0]).toMatchObject({ size: null, color: null });

    const overview = await dashboard.overview();
    expect(overview.cards.lowStockProducts).toBe(2);
    expect(overview.lowStock).toHaveLength(2);
  });

  it('adds up a month, with expenses by type, and leaves out other months', async () => {
    const watch = await prisma.product.create({
      data: {
        categoryId,
        name: 'Watch',
        slug: 'watch',
        sku: 'W-1',
        price: '1000',
        costPrice: '600',
        stockQuantity: 10,
      },
    });
    await pos.createSale(
      adminId,
      { items: [{ productId: watch.id, quantity: 2 }], paymentMethod: 'CASH', cashReceived: 2000 },
      randomUUID(),
    );
    const day = today();
    const add = (date: string, category: 'RENT' | 'SUPPLIER_PAYMENT', amount: number) =>
      expenses.create(adminId, { date, category, amount, paidFromDrawer: true }, null);
    await add(day, 'RENT', 300);
    await add(day, 'SUPPLIER_PAYMENT', 500);
    await add('2020-01-15', 'RENT', 9999);

    const month = await dashboard.monthlyReport(day.slice(0, 7));
    expect(month).toMatchObject({
      total: '2000.00',
      profit: '800.00',
      running: '300.00',
      supplierPayments: '500.00',
      takeHome: '500.00',
      itemsSold: 2,
      unknownCostUnits: 0,
    });
    expect(month.byCategory).toEqual(
      expect.arrayContaining([
        { category: 'RENT', total: '300.00' },
        { category: 'SUPPLIER_PAYMENT', total: '500.00' },
      ]),
    );
    expect(month.days.find((entry) => entry.date === day)).toMatchObject({
      total: '2000.00',
      takeHome: '500.00',
    });
    expect(month.days.every((entry) => entry.date <= day)).toBe(true);

    const old = await dashboard.monthlyReport('2020-01');
    expect(old.running).toBe('9999.00');
    expect(old.days).toHaveLength(31);
  });

  it('shows nothing for a future month', async () => {
    const future = await dashboard.monthlyReport('2999-01');
    expect(future.days).toHaveLength(0);
    expect(future.total).toBe('0.00');
  });
});
