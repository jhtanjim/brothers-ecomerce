import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderExpiryService } from './order-expiry.service';
import { OrdersService } from './orders.service';

const SHIPPING = {
  fullName: 'Test Customer',
  phone: '01700000000',
  email: 'c@example.com',
  addressLine: '1 Test Road',
  city: 'Dhaka',
  area: 'Gulshan',
  postalCode: '1212',
  paymentMethod: 'BKASH',
} as CreateOrderDto;

describe('order expiry job (integration)', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let expiry: OrderExpiryService;
  let productId: string;
  let userId: string;

  const stock = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
  const getOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });
  const past = () => new Date(Date.now() - 60_000);

  async function placeOrder(couponCode?: string) {
    const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 2 } });
    return orders.create(
      userId,
      { ...SHIPPING, ...(couponCode ? { couponCode } : {}) } as CreateOrderDto,
      randomUUID(),
    );
  }

  async function placeOverdueOrder(couponCode?: string) {
    const order = await placeOrder(couponCode);
    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: past() } });
    return order;
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const cancellation = new OrderCancellationService();
    orders = new OrdersService(
      service,
      new SettingsService(service),
      {} as CloudinaryService,
      cancellation,
    );
    expiry = new OrderExpiryService(service, cancellation);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const category = await prisma.category.create({ data: { name: 'Cat', slug: 'cat' } });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: 'Widget',
        slug: 'widget',
        sku: 'W-1',
        price: '1000',
        stockQuantity: 10,
      },
    });
    productId = product.id;
    userId = (
      await prisma.user.create({
        data: { name: 'Cust', email: 'cust@example.com', passwordHash: 'x' },
      })
    ).id;
  });

  it('cancels an overdue unpaid order and gives back stock and the coupon', async () => {
    const coupon = await prisma.coupon.create({
      data: { code: 'EXP10', type: 'PERCENTAGE', value: '10' },
    });
    const order = await placeOverdueOrder(coupon.code);
    expect(await stock()).toBe(8);

    await expiry.run();

    const row = await getOrder(order.id);
    expect(row.status).toBe('CANCELLED');
    expect(row.cancellationReason).toBe('Payment window expired');
    expect(await stock()).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0);
    expect(await prisma.couponUsage.count()).toBe(0);
    const history = await prisma.orderStatusHistory.findFirstOrThrow({
      where: { orderId: order.id, toStatus: 'CANCELLED' },
    });
    expect(history.changedById).toBeNull();
  });

  it('leaves an order that is not yet due', async () => {
    const order = await placeOrder();
    await expiry.run();
    expect((await getOrder(order.id)).status).toBe('PENDING_PAYMENT');
    expect(await stock()).toBe(8);
  });

  it('skips an order whose payment is under review', async () => {
    const order = await placeOverdueOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PENDING', expiresAt: past() },
    });

    await expiry.run();

    expect((await getOrder(order.id)).status).toBe('PENDING_PAYMENT');
    expect(await stock()).toBe(8);
  });

  it('skips a paid order', async () => {
    const order = await placeOverdueOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PROCESSING', paymentStatus: 'APPROVED' },
    });

    await expiry.run();

    expect((await getOrder(order.id)).status).toBe('PROCESSING');
    expect(await stock()).toBe(8);
  });

  it('cancels a rejected-payment order once its retry window has passed', async () => {
    const order = await placeOverdueOrder();
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REJECTED' } });

    await expiry.run();

    expect((await getOrder(order.id)).status).toBe('CANCELLED');
    expect(await stock()).toBe(10);
  });

  it('does not touch an already cancelled order again', async () => {
    const order = await placeOverdueOrder();
    await expiry.run();
    expect(await stock()).toBe(10);

    await prisma.order.update({ where: { id: order.id }, data: { expiresAt: past() } });
    await expiry.run();

    expect(await stock()).toBe(10);
    expect(
      await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: 'CANCELLED' },
      }),
    ).toBe(1);
  });

  it('cancels several overdue orders in one run', async () => {
    await placeOverdueOrder();
    await placeOverdueOrder();
    await placeOverdueOrder();
    expect(await stock()).toBe(4);

    await expiry.run();

    expect(await prisma.order.count({ where: { status: 'CANCELLED' } })).toBe(3);
    expect(await stock()).toBe(10);
  });
});
