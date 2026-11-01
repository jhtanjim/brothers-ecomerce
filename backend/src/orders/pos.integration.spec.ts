import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AdminOrdersService } from './admin-orders.service';
import { OrderCancellationService } from './order-cancellation.service';
import { OrdersService } from './orders.service';
import { PosService } from './pos.service';

describe('POS sales (integration)', () => {
  let prisma: PrismaClient;
  let pos: PosService;
  let adminId: string;
  let shirt: string;
  let medium: string;
  let watch: string;

  const stockOf = async (id: string) =>
    (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity;
  const optionStock = async () =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id: medium } })).stockQuantity;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const cancellation = new OrderCancellationService();
    const logs = new ActivityLogsService();
    const orders = new OrdersService(
      service,
      new SettingsService(service),
      {} as CloudinaryService,
      cancellation,
    );
    const adminOrders = new AdminOrdersService(service, cancellation, logs);
    pos = new PosService(service, orders, adminOrders, cancellation, logs);
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
    const shirtRow = await prisma.product.create({
      data: {
        categoryId,
        name: 'Shirt',
        slug: 'shirt',
        sku: 'S-1',
        price: '1000',
        discountPrice: '800',
        discountPercent: 20,
        stockQuantity: 3,
        variants: { create: { size: 'M', color: 'Blue', sku: 'S-1-M', stockQuantity: 3 } },
      },
      include: { variants: true },
    });
    shirt = shirtRow.id;
    medium = shirtRow.variants[0]!.id;
    watch = (
      await prisma.product.create({
        data: {
          categoryId,
          name: 'Watch',
          slug: 'watch',
          sku: 'W-1',
          price: '500',
          stockQuantity: 2,
        },
      })
    ).id;
  });

  it('records a paid, completed sale and takes the stock', async () => {
    const sale = await pos.createSale(
      adminId,
      {
        items: [
          { productId: shirt, variantId: medium, quantity: 2 },
          { productId: watch, quantity: 1 },
        ],
        discount: 100,
        paymentMethod: 'CASH',
        cashReceived: 2000,
      },
      randomUUID(),
    );

    expect(sale.orderNumber.startsWith('POS-')).toBe(true);
    expect(sale).toMatchObject({
      channel: 'POS',
      status: 'DELIVERED',
      paymentStatus: 'APPROVED',
      totalAmount: '2000.00',
      cashReceived: '2000.00',
      deliveryCharge: '0.00',
      shipping: { name: 'Walk-in customer' },
      payment: { method: 'CASH', status: 'APPROVED' },
    });
    expect(sale.totalAmount).toBe('2000.00');
    expect(await stockOf(shirt)).toBe(1);
    expect(await optionStock()).toBe(1);
    expect(await stockOf(watch)).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: shirt } })).soldCount).toBe(2);
  });

  it('shows what a customer bought, leaving out cancelled sales', async () => {
    const sell = (customerPhone: string, customerName?: string) =>
      pos.createSale(
        adminId,
        {
          items: [{ productId: watch, quantity: 1 }],
          paymentMethod: 'CASH',
          cashReceived: 500,
          customerPhone,
          ...(customerName ? { customerName } : {}),
        },
        randomUUID(),
      );
    await sell('01712345678', 'Rahim');
    const cancelled = await sell('+8801712345678');
    await pos.voidSale(adminId, cancelled.id, 'Mistake', null);

    await expect(pos.customerHistory('8801712345678')).resolves.toMatchObject({
      name: 'Rahim',
      purchaseCount: 1,
      totalSpent: '500.00',
      recent: [{ totalAmount: '500.00', items: [{ productName: 'Watch', quantity: 1 }] }],
    });
    await expect(pos.customerHistory('01811111111')).resolves.toMatchObject({
      name: null,
      purchaseCount: 0,
      totalSpent: '0.00',
      recent: [],
    });
  });

  it('does not sell twice when the same sale is submitted again', async () => {
    const key = randomUUID();
    const dto = {
      items: [{ productId: watch, quantity: 1 }],
      paymentMethod: 'CASH' as const,
      cashReceived: 500,
    };
    const first = await pos.createSale(adminId, dto, key);
    const second = await pos.createSale(adminId, dto, key);
    expect(second.id).toBe(first.id);
    expect(await stockOf(watch)).toBe(1);
  });

  it('refuses too little cash and changes nothing', async () => {
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 1 }], paymentMethod: 'CASH', cashReceived: 499 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_CASH_TOO_LOW' } });
    expect(await stockOf(watch)).toBe(2);
    expect(await prisma.order.count()).toBe(0);
  });

  it('refuses a discount above the total', async () => {
    await expect(
      pos.createSale(
        adminId,
        {
          items: [{ productId: watch, quantity: 1 }],
          discount: 501,
          paymentMethod: 'CASH',
          cashReceived: 500,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_DISCOUNT_TOO_LARGE' } });
    expect(await stockOf(watch)).toBe(2);
  });

  it('refuses more than is in stock, a missing option and a repeated line', async () => {
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 3 }], paymentMethod: 'CASH', cashReceived: 5000 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: shirt, quantity: 1 }], paymentMethod: 'CASH', cashReceived: 5000 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'OPTION_REQUIRED' } });
    await expect(
      pos.createSale(
        adminId,
        {
          items: [
            { productId: watch, quantity: 1 },
            { productId: watch, quantity: 1 },
          ],
          paymentMethod: 'CASH',
          cashReceived: 5000,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_DUPLICATE_ITEM' } });
    expect(await stockOf(watch)).toBe(2);
    expect(await stockOf(shirt)).toBe(3);
  });

  it('voids a sale and restores stock and sold count', async () => {
    const sale = await pos.createSale(
      adminId,
      {
        items: [{ productId: shirt, variantId: medium, quantity: 2 }],
        paymentMethod: 'CASH',
        cashReceived: 1600,
      },
      randomUUID(),
    );
    const voided = await pos.voidSale(adminId, sale.id, 'Customer changed mind', null);

    expect(voided.status).toBe('CANCELLED');
    expect(await stockOf(shirt)).toBe(3);
    expect(await optionStock()).toBe(3);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: shirt } })).soldCount).toBe(0);
    await expect(pos.voidSale(adminId, sale.id, 'Again please', null)).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_CANCELLABLE' },
    });
  });

  it('takes bKash with a transaction ID, which cannot be used twice', async () => {
    const dto = {
      items: [{ productId: watch, quantity: 1 }],
      paymentMethod: 'BKASH' as const,
      transactionId: 'ABC12345',
    };
    const sale = await pos.createSale(adminId, dto, randomUUID());
    expect(sale).toMatchObject({
      cashReceived: null,
      payment: { method: 'BKASH', status: 'APPROVED' },
    });
    expect(sale.payment?.submissions[0]?.transactionId).toBe('ABC12345');

    await expect(pos.createSale(adminId, dto, randomUUID())).rejects.toMatchObject({
      response: { code: 'POS_TRANSACTION_ID_USED' },
    });
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 1 }], paymentMethod: 'NAGAD' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_TRANSACTION_ID_REQUIRED' } });
    expect(await stockOf(watch)).toBe(1);
  });

  it('reports a day by channel and method, leaving out cancelled sales', async () => {
    const buy = (data: object) =>
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 1 }], ...data } as never,
        randomUUID(),
      );
    await buy({ paymentMethod: 'CASH', cashReceived: 500 });
    await buy({ paymentMethod: 'BKASH', transactionId: 'REPORT001' });

    const dashboard = new DashboardService(prisma as unknown as PrismaService);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    const report = await dashboard.dailyReport(today);
    expect(report).toMatchObject({ total: '1000.00', itemsSold: 2 });
    expect(report.pos.methods).toEqual(
      expect.arrayContaining([
        { method: 'CASH', sales: 1, total: '500.00' },
        { method: 'BKASH', sales: 1, total: '500.00' },
      ]),
    );
    expect(report.topItems[0]).toMatchObject({ name: 'Watch', quantity: 2, total: '1000.00' });

    const sold = await prisma.order.findFirstOrThrow({ where: { cashReceived: { not: null } } });
    await pos.voidSale(adminId, sold.id, 'Returned', null);
    const after = await dashboard.dailyReport(today);
    expect(after.total).toBe('500.00');
    expect(after.cancelledPos).toEqual({ sales: 1, total: '500.00' });

    expect((await dashboard.dailyReport('2020-01-01')).total).toBe('0.00');
  });
});
