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
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { ExpensesService } from './expenses.service';

describe('expenses and the cash drawer (integration)', () => {
  let prisma: PrismaClient;
  let expenses: ExpensesService;
  let dashboard: DashboardService;
  let pos: PosService;
  let returns: ReturnsService;
  let adminId: string;
  let watch: string;

  const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const add = (
    category: 'RENT' | 'OTHER' | 'SUPPLIER_PAYMENT',
    amount: number,
    paidFromDrawer = true,
  ) => expenses.create(adminId, { date: today(), category, amount, paidFromDrawer }, null);
  const sell = (quantity = 1) =>
    pos.createSale(
      adminId,
      {
        items: [{ productId: watch, quantity }],
        paymentMethod: 'CASH',
        cashReceived: 1000 * quantity,
      },
      randomUUID(),
    );

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const logs = new ActivityLogsService();
    const cancellation = new OrderCancellationService();
    expenses = new ExpensesService(service, logs);
    dashboard = new DashboardService(service);
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
    returns = new ReturnsService(service, logs);
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
    watch = (
      await prisma.product.create({
        data: {
          categoryId,
          name: 'Watch',
          slug: 'watch',
          sku: 'W-1',
          price: '1000',
          costPrice: '600',
          stockQuantity: 10,
        },
      })
    ).id;
  });

  it('takes running costs off profit, but not supplier payments', async () => {
    await sell(2); // profit 800
    await add('RENT', 300);
    await add('SUPPLIER_PAYMENT', 500);

    const report = await dashboard.dailyReport(today());
    expect(report.expenses).toEqual({
      count: 2,
      running: '300.00',
      supplierPayments: '500.00',
    });
    expect(report.takeHome).toBe('500.00');
  });

  it('works out the drawer and any difference from the count', async () => {
    await sell(2);
    await add('RENT', 300);
    await add('OTHER', 100, false); // Paid from elsewhere: not from the drawer.
    await add('SUPPLIER_PAYMENT', 500);
    const sale = await sell(1);
    await returns.create(
      adminId,
      sale.id,
      {
        items: [{ orderItemId: sale.items[0]!.id, quantity: 1 }],
        reason: 'Faulty',
        restock: true,
        refundMethod: 'CASH',
      },
      randomUUID(),
      null,
    );
    await expenses.updateCashDay(adminId, today(), { openingCash: 2000 });

    let report = await dashboard.dailyReport(today());
    // 2000 opening + 3000 cash sales - 1000 refund - 300 - 500 = 3200.
    expect(report.drawer).toEqual({
      opening: '2000.00',
      cashSales: '3000.00',
      cashRefunds: '1000.00',
      drawerExpenses: '800.00',
      expected: '3200.00',
      counted: null,
      difference: null,
    });

    await expenses.updateCashDay(adminId, today(), { countedCash: 3150 });
    report = await dashboard.dailyReport(today());
    expect(report.drawer).toMatchObject({
      opening: '2000.00',
      counted: '3150.00',
      difference: '-50.00',
    });
  });

  it('cannot give an expected amount without opening cash', async () => {
    await sell(1);
    const report = await dashboard.dailyReport(today());
    expect(report.drawer).toMatchObject({ opening: null, expected: null, cashSales: '1000.00' });
  });

  it('removes an expense, and refuses future or impossible dates', async () => {
    const row = await add('RENT', 300);
    expect(await expenses.listForDay(today())).toHaveLength(1);
    await expenses.remove(adminId, row.id, null);
    expect(await expenses.listForDay(today())).toHaveLength(0);
    expect((await dashboard.dailyReport(today())).takeHome).toBe('0.00');

    for (const date of ['2999-01-01', '2026-02-31']) {
      await expect(
        expenses.create(adminId, { date, category: 'RENT', amount: 1, paidFromDrawer: true }, null),
      ).rejects.toMatchObject({ response: { code: 'INVALID_DAY' } });
    }
  });

  it('counts each day separately', async () => {
    await expenses.create(
      adminId,
      { date: '2026-01-15', category: 'RENT', amount: 900, paidFromDrawer: true },
      null,
    );
    await expenses.updateCashDay(adminId, '2026-01-15', { openingCash: 100 });
    expect((await dashboard.dailyReport('2026-01-15')).expenses.running).toBe('900.00');
    expect((await dashboard.dailyReport(today())).expenses.running).toBe('0.00');
    expect((await dashboard.dailyReport(today())).drawer.opening).toBeNull();
  });
});
