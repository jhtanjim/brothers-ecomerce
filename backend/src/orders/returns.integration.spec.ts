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
import { ReturnsService, refundForLine } from './returns.service';

describe('refundForLine', () => {
  const line = {
    lineTotalCents: 100000,
    itemsTotalCents: 100000,
    saleDiscountCents: 0,
    orderedQuantity: 3,
    returnedQuantity: 0,
    returnedCents: 0,
    quantity: 1,
  };

  it('never pays out more than the line, whatever the rounding', () => {
    const first = refundForLine(line);
    const second = refundForLine({ ...line, returnedQuantity: 1, returnedCents: first });
    const third = refundForLine({
      ...line,
      returnedQuantity: 2,
      returnedCents: first + second,
    });
    expect(first).toBe(33333);
    expect(first + second + third).toBe(100000);
  });

  it('takes off the share of a discount on the whole sale', () => {
    expect(
      refundForLine({
        lineTotalCents: 60000,
        itemsTotalCents: 100000,
        saleDiscountCents: 10000,
        orderedQuantity: 1,
        returnedQuantity: 0,
        returnedCents: 0,
        quantity: 1,
      }),
    ).toBe(54000);
  });
});

describe('returns and exchanges (integration)', () => {
  let prisma: PrismaClient;
  let pos: PosService;
  let returns: ReturnsService;
  let dashboard: DashboardService;
  let adminId: string;
  let shirt: string;
  let medium: string;
  let large: string;

  const today = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const stock = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
  const total = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: shirt } })).stockQuantity;

  async function sell(quantity = 2, extra: object = {}) {
    return pos.createSale(
      adminId,
      {
        items: [{ productId: shirt, variantId: medium, quantity }],
        paymentMethod: 'CASH',
        cashReceived: 100000,
        ...extra,
      },
      randomUUID(),
    );
  }

  function giveBack(
    orderId: string,
    orderItemId: string,
    quantity: number,
    extra: { restock?: boolean; refundMethod?: 'CASH' | 'BKASH' | 'NAGAD' } = {},
  ) {
    return returns.create(
      adminId,
      orderId,
      {
        items: [{ orderItemId, quantity }],
        reason: 'Wrong size',
        restock: true,
        ...extra,
      },
      randomUUID(),
      null,
    );
  }

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
        stockQuantity: 10,
        variants: {
          create: [
            { size: 'M', sku: 'S-1-M', stockQuantity: 5 },
            { size: 'L', sku: 'S-1-L', stockQuantity: 5 },
          ],
        },
      },
      include: { variants: true },
    });
    shirt = row.id;
    medium = row.variants.find((variant) => variant.size === 'M')!.id;
    large = row.variants.find((variant) => variant.size === 'L')!.id;
  });

  it('refunds part of a sale and puts the items back in stock', async () => {
    const sale = await sell(2);
    const made = await giveBack(sale.id, sale.items[0]!.id, 1, { refundMethod: 'CASH' });

    expect(made).toMatchObject({ refundAmount: '1000.00', refundMethod: 'CASH', restocked: true });
    expect(made.returnNumber.startsWith('RET-')).toBe(true);
    expect(await stock(medium)).toBe(4);
    expect(await total()).toBe(9);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: shirt } })).soldCount).toBe(1);
  });

  it('does not put damaged items back on sale', async () => {
    const sale = await sell(1);
    await giveBack(sale.id, sale.items[0]!.id, 1, { refundMethod: 'CASH', restock: false });
    expect(await stock(medium)).toBe(4);
    expect(await total()).toBe(9);
  });

  it('never returns more than was sold, across several returns', async () => {
    const sale = await sell(2);
    const itemId = sale.items[0]!.id;
    await giveBack(sale.id, itemId, 1, { refundMethod: 'CASH' });
    await expect(giveBack(sale.id, itemId, 2, { refundMethod: 'CASH' })).rejects.toMatchObject({
      response: { code: 'RETURN_QUANTITY_TOO_HIGH' },
    });
    await giveBack(sale.id, itemId, 1, { refundMethod: 'CASH' });
    expect(await stock(medium)).toBe(5);
  });

  it('does not process the same return twice', async () => {
    const sale = await sell(2);
    const key = randomUUID();
    const dto = {
      items: [{ orderItemId: sale.items[0]!.id, quantity: 1 }],
      reason: 'Wrong size',
      restock: true,
      refundMethod: 'CASH' as const,
    };
    const first = await returns.create(adminId, sale.id, dto, key, null);
    const second = await returns.create(adminId, sale.id, dto, key, null);
    expect(second.id).toBe(first.id);
    expect(await stock(medium)).toBe(4);
  });

  it('refuses orders that are not paid and completed', async () => {
    const sale = await sell(1);
    await pos.voidSale(adminId, sale.id, 'Mistake', null);
    await expect(
      giveBack(sale.id, sale.items[0]!.id, 1, { refundMethod: 'CASH' }),
    ).rejects.toMatchObject({ response: { code: 'RETURN_NOT_ALLOWED' } });
  });

  it('exchanges a size: credit pays towards the new sale, once only', async () => {
    const sale = await sell(1);
    const credit = await giveBack(sale.id, sale.items[0]!.id, 1);
    expect(credit.refundMethod).toBeNull();

    const items = [{ productId: shirt, variantId: large, quantity: 2 }];
    const next = await pos.createSale(
      adminId,
      { items, paymentMethod: 'CASH', cashReceived: 1000, exchangeReturnId: credit.id },
      randomUUID(),
    );
    expect(next).toMatchObject({
      totalAmount: '2000.00',
      exchangeCredit: '1000.00',
      cashReceived: '1000.00',
      payment: { amount: '1000.00' },
    });
    expect(await stock(medium)).toBe(5);
    expect(await stock(large)).toBe(3);

    await expect(
      pos.createSale(
        adminId,
        { items, paymentMethod: 'CASH', cashReceived: 5000, exchangeReturnId: credit.id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_CREDIT_INVALID' } });
    expect(await stock(large)).toBe(3);
  });

  it('refuses a refunded return as credit, and too little cash after credit', async () => {
    const sale = await sell(2);
    const refunded = await giveBack(sale.id, sale.items[0]!.id, 1, { refundMethod: 'CASH' });
    const items = [{ productId: shirt, variantId: large, quantity: 1 }];
    await expect(
      pos.createSale(
        adminId,
        { items, paymentMethod: 'CASH', cashReceived: 1000, exchangeReturnId: refunded.id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_CREDIT_INVALID' } });

    const credit = await giveBack(sale.id, sale.items[0]!.id, 1);
    await expect(
      pos.createSale(
        adminId,
        {
          items: [{ productId: shirt, variantId: large, quantity: 2 }],
          paymentMethod: 'CASH',
          cashReceived: 999,
          exchangeReturnId: credit.id,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_CASH_TOO_LOW' } });
  });

  it('pays any credit left over in cash, never by bKash', async () => {
    const sale = await sell(2);
    const credit = await giveBack(sale.id, sale.items[0]!.id, 2);
    const items = [{ productId: shirt, variantId: large, quantity: 1 }];
    await expect(
      pos.createSale(
        adminId,
        { items, paymentMethod: 'BKASH', transactionId: 'EXCH00001', exchangeReturnId: credit.id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_CREDIT_NEEDS_CASH' } });

    const next = await pos.createSale(
      adminId,
      { items, paymentMethod: 'CASH', exchangeReturnId: credit.id },
      randomUUID(),
    );
    expect(next).toMatchObject({ exchangeCredit: '2000.00', payment: { amount: '0.00' } });
    const report = await dashboard.dailyReport(today());
    // Cash: 2000 from the first sale, minus 1000 handed back as the difference.
    expect(report.pos.methods).toContainEqual({ method: 'CASH', sales: 2, total: '1000.00' });
    expect(report.total).toBe('1000.00');
  });

  it('keeps a sale with returns from being cancelled, and frees credit if an exchange is', async () => {
    const sale = await sell(1);
    const credit = await giveBack(sale.id, sale.items[0]!.id, 1);
    await expect(pos.voidSale(adminId, sale.id, 'Oops', null)).rejects.toMatchObject({
      response: { code: 'POS_SALE_HAS_RETURNS' },
    });

    const next = await pos.createSale(
      adminId,
      {
        items: [{ productId: shirt, variantId: large, quantity: 1 }],
        paymentMethod: 'CASH',
        exchangeReturnId: credit.id,
      },
      randomUUID(),
    );
    await pos.voidSale(adminId, next.id, 'Oops', null);
    expect((await returns.findOne(credit.id)).exchangeOrderId).toBeNull();
    expect(await stock(large)).toBe(5);
  });

  it('takes refunds off the daily report and drawer', async () => {
    const sale = await sell(2);
    await giveBack(sale.id, sale.items[0]!.id, 1, { refundMethod: 'CASH' });
    const report = await dashboard.dailyReport(today());
    expect(report).toMatchObject({
      total: '1000.00',
      returns: {
        count: 1,
        total: '1000.00',
        credit: '0.00',
        refunds: [{ method: 'CASH', total: '1000.00' }],
      },
    });
    expect((await dashboard.overview()).cards.todaySales).toBe('1000.00');
  });
});
