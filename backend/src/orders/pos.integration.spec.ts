import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
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

  it('does not sell twice when the same sale is submitted again', async () => {
    const key = randomUUID();
    const dto = { items: [{ productId: watch, quantity: 1 }], cashReceived: 500 };
    const first = await pos.createSale(adminId, dto, key);
    const second = await pos.createSale(adminId, dto, key);
    expect(second.id).toBe(first.id);
    expect(await stockOf(watch)).toBe(1);
  });

  it('refuses too little cash and changes nothing', async () => {
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 1 }], cashReceived: 499 },
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
        { items: [{ productId: watch, quantity: 1 }], discount: 501, cashReceived: 500 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'POS_DISCOUNT_TOO_LARGE' } });
    expect(await stockOf(watch)).toBe(2);
  });

  it('refuses more than is in stock, a missing option and a repeated line', async () => {
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: watch, quantity: 3 }], cashReceived: 5000 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
    await expect(
      pos.createSale(
        adminId,
        { items: [{ productId: shirt, quantity: 1 }], cashReceived: 5000 },
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
      { items: [{ productId: shirt, variantId: medium, quantity: 2 }], cashReceived: 1600 },
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
});
