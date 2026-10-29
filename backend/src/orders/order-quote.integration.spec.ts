import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/settings.constants';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderQuoteService } from './order-quote.service';
import { OrdersService } from './orders.service';

const SHIPPING = {
  fullName: 'Test Customer',
  phone: '01700000000',
  email: 'c@example.com',
  addressLine: '1 Test Road',
  area: 'Gulshan',
  postalCode: '1212',
  paymentMethod: 'BKASH',
} as CreateOrderDto;

describe('order quote (integration)', () => {
  let prisma: PrismaClient;
  let quotes: OrderQuoteService;
  let orders: OrdersService;
  let userId: string;
  let productId: string;

  async function setSetting(key: string, value: unknown) {
    await prisma.setting.create({ data: { key, value: value as never } });
  }

  async function makeCoupon(data: Record<string, unknown> = {}) {
    return prisma.coupon.create({
      data: {
        code: 'Q' + randomUUID().slice(0, 8).toUpperCase(),
        type: 'PERCENTAGE',
        value: '10',
        ...data,
      } as never,
    });
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const settings = new SettingsService(service);
    quotes = new OrderQuoteService(service, settings);
    orders = new OrdersService(
      service,
      settings,
      {} as CloudinaryService,
      new OrderCancellationService(),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await setSetting(SETTING_KEYS.deliveryHomeCity, 'Dhaka');
    await setSetting(SETTING_KEYS.deliveryHomeCityCharge, 60);
    await setSetting(SETTING_KEYS.deliveryOtherCityCharge, 120);
    const category = await prisma.category.create({ data: { name: 'Cat', slug: 'cat' } });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: 'Widget',
        slug: 'widget',
        sku: 'W-1',
        price: '1000',
        discountPrice: '900',
        stockQuantity: 10,
      },
    });
    productId = product.id;
    const user = await prisma.user.create({
      data: { name: 'Q', email: `q-${randomUUID()}@example.com`, passwordHash: 'x' },
    });
    userId = user.id;
    const cart = await prisma.cart.create({ data: { userId } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 2 } });
  });

  it('without a city, shows item amounts but no delivery charge or total', async () => {
    const quote = await quotes.quote(userId, {});
    expect(quote).toMatchObject({
      subtotal: '2000.00',
      discount: '200.00',
      couponDiscount: '0.00',
      deliveryCharge: null,
      total: null,
      couponError: null,
    });
  });

  it('charges the home-city rate (case-insensitive) and the other-city rate', async () => {
    expect(await quotes.quote(userId, { city: 'dhaka' })).toMatchObject({
      deliveryCharge: '60.00',
      total: '1860.00',
    });
    expect(await quotes.quote(userId, { city: 'Sylhet' })).toMatchObject({
      deliveryCharge: '120.00',
      total: '1920.00',
    });
  });

  it('ships free at or above the free-delivery threshold and reports the threshold', async () => {
    await setSetting(SETTING_KEYS.deliveryFreeThreshold, 1800);
    const quote = await quotes.quote(userId, { city: 'Sylhet' });
    expect(quote).toMatchObject({
      deliveryCharge: '0.00',
      total: '1800.00',
      freeDeliveryThreshold: '1800.00',
    });
  });

  it('applies a valid coupon after product discounts', async () => {
    const coupon = await makeCoupon();
    const quote = await quotes.quote(userId, {
      city: 'Dhaka',
      couponCode: coupon.code.toLowerCase(),
    });
    expect(quote).toMatchObject({
      couponCode: coupon.code,
      couponDiscount: '180.00',
      deliveryCharge: '60.00',
      total: '1680.00',
      couponError: null,
    });
  });

  it('reports an unusable coupon without failing the quote', async () => {
    const expired = await makeCoupon({ expiresAt: new Date(Date.now() - 60_000) });
    const quote = await quotes.quote(userId, { city: 'Dhaka', couponCode: expired.code });
    expect(quote.couponCode).toBeNull();
    expect(quote.couponDiscount).toBe('0.00');
    expect(quote.couponError?.code).toBe('COUPON_EXPIRED');
    expect(quote.total).toBe('1860.00');

    const missing = await quotes.quote(userId, { city: 'Dhaka', couponCode: 'NOPE' });
    expect(missing.couponError?.code).toBe('COUPON_NOT_FOUND');
  });

  it('matches the total of the order that is actually placed', async () => {
    const coupon = await makeCoupon({ type: 'FIXED', value: '75' });
    const quote = await quotes.quote(userId, { city: 'Chattogram', couponCode: coupon.code });
    const order = await orders.create(
      userId,
      { ...SHIPPING, city: 'Chattogram', couponCode: coupon.code } as CreateOrderDto,
      randomUUID(),
    );
    expect(order.totalAmount).toBe(quote.total);
    expect(order.deliveryCharge).toBe(quote.deliveryCharge);
    expect(order.couponDiscount).toBe(quote.couponDiscount);
  });

  it('refuses an empty cart and never changes stock', async () => {
    await quotes.quote(userId, { city: 'Dhaka' });
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity,
    ).toBe(10);

    await prisma.cartItem.deleteMany({});
    await expect(quotes.quote(userId, { city: 'Dhaka' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
