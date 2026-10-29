import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCancellationService } from './order-cancellation.service';
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

describe('orders (integration)', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let cancellation: OrderCancellationService;
  let productId: string;

  async function makeUser(tag: string): Promise<string> {
    const user = await prisma.user.create({
      data: { name: tag, email: `${tag}-${randomUUID()}@example.com`, passwordHash: 'x' },
    });
    return user.id;
  }

  async function fillCart(userId: string, quantity: number): Promise<void> {
    const cart = await prisma.cart.create({ data: { userId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
  }

  async function makeCoupon(data: Record<string, unknown> = {}) {
    return prisma.coupon.create({
      data: {
        code: 'C' + randomUUID().slice(0, 8).toUpperCase(),
        type: 'PERCENTAGE',
        value: '10',
        ...data,
      } as never,
    });
  }

  const stock = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;

  function place(userId: string, couponCode?: string, key: string = randomUUID()) {
    return orders.create(
      userId,
      { ...SHIPPING, ...(couponCode ? { couponCode } : {}) } as CreateOrderDto,
      key,
    );
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    orders = new OrdersService(
      service,
      new SettingsService(service),
      {} as CloudinaryService,
      (cancellation = new OrderCancellationService()),
    );
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
        stockQuantity: 5,
      },
    });
    productId = product.id;
  });

  it('places an order with a coupon and records everything', async () => {
    const userId = await makeUser('a');
    const coupon = await makeCoupon();
    await fillCart(userId, 2);

    const order = await place(userId, coupon.code);

    expect(order.subtotal).toBe('2000.00');
    expect(order.couponDiscount).toBe('200.00');
    expect(order.totalAmount).toBe('1860.00'); // 2000 - 200 + 60 delivery (Dhaka)
    expect(await stock()).toBe(3);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
    expect(await prisma.couponUsage.count({ where: { orderId: order.id } })).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).couponCode).toBe(
      coupon.code,
    );
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('cancelling gives back stock and the coupon', async () => {
    const userId = await makeUser('a');
    const coupon = await makeCoupon();
    await fillCart(userId, 2);
    const order = await place(userId, coupon.code);

    await prisma.$transaction((tx) =>
      cancellation.cancelInTx(tx, order.id, {
        source: 'CUSTOMER',
        reason: 'test',
        actorId: userId,
        ownerId: userId,
      }),
    );

    expect(await stock()).toBe(5);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(0);
    expect(await prisma.couponUsage.count()).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'CANCELLED',
    );
  });

  it('an expired coupon fails and rolls everything back', async () => {
    const userId = await makeUser('a');
    const coupon = await makeCoupon({ expiresAt: new Date(Date.now() - 60_000) });
    await fillCart(userId, 2);

    await expect(place(userId, coupon.code)).rejects.toMatchObject({
      response: { code: 'COUPON_EXPIRED' },
    });

    expect(await stock()).toBe(5);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('an unknown coupon fails with COUPON_NOT_FOUND', async () => {
    const userId = await makeUser('a');
    await fillCart(userId, 1);
    await expect(place(userId, 'NOPE')).rejects.toMatchObject({
      response: { code: 'COUPON_NOT_FOUND' },
    });
    expect(await stock()).toBe(5);
  });

  it('a coupon with usage limit 1 cannot be used twice', async () => {
    const first = await makeUser('a');
    const second = await makeUser('b');
    const coupon = await makeCoupon({ usageLimit: 1 });
    await fillCart(first, 1);
    await place(first, coupon.code);
    await fillCart(second, 1);

    await expect(place(second, coupon.code)).rejects.toMatchObject({
      response: { code: 'COUPON_USAGE_LIMIT_REACHED' },
    });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
  });

  it('two customers racing for the last unit: exactly one wins', async () => {
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 1 } });
    const a = await makeUser('a');
    const b = await makeUser('b');
    await fillCart(a, 1);
    await fillCart(b, 1);

    const results = await Promise.allSettled([place(a), place(b)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ response: { code: 'INSUFFICIENT_STOCK' } });
    expect(await stock()).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('replaying the same idempotency key returns the same order', async () => {
    const userId = await makeUser('a');
    const coupon = await makeCoupon();
    await fillCart(userId, 1);
    const key = randomUUID();

    const first = await place(userId, coupon.code, key);
    const second = await place(userId, coupon.code, key);

    expect(second.id).toBe(first.id);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })).usedCount).toBe(1);
    expect(await stock()).toBe(4);
  });
});
