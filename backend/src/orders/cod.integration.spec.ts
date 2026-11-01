import { randomUUID } from 'node:crypto';
import type { OrderStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { AdminPaymentsService } from '../payments/admin-payments.service';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AdminOrdersService } from './admin-orders.service';
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
  cashOnDelivery: true,
} as CreateOrderDto;

describe('cash on delivery (integration)', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let payments: PaymentsService;
  let payReview: AdminPaymentsService;
  let adminOrders: AdminOrdersService;
  let dashboard: DashboardService;
  let settings: SettingsService;
  let productId: string;
  let userId: string;
  let adminId: string;

  const stock = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;

  async function place(dto: CreateOrderDto = SHIPPING) {
    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: 2 } });
    return orders.create(userId, dto, randomUUID());
  }

  async function payAdvance(orderId: string) {
    await payments.submit(
      userId,
      { orderId, transactionId: 'TXCOD0001', senderPhone: '01711111111' } as CreatePaymentDto,
      undefined,
    );
    const row = await prisma.paymentTransaction.findFirstOrThrow({
      where: { payment: { orderId }, status: 'PENDING' },
    });
    await payReview.approve(adminId, row.id, null);
  }

  async function move(orderId: string, ...steps: OrderStatus[]) {
    for (const status of steps) {
      await adminOrders.updateStatus(adminId, orderId, { status }, null);
    }
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    settings = new SettingsService(service);
    const cloudinary = {} as CloudinaryService;
    const cancellation = new OrderCancellationService();
    const logs = new ActivityLogsService();
    orders = new OrdersService(service, settings, cloudinary, cancellation);
    payments = new PaymentsService(service, settings, cloudinary);
    payReview = new AdminPaymentsService(service, settings, cloudinary, logs);
    adminOrders = new AdminOrdersService(service, cancellation, logs);
    dashboard = new DashboardService(service);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    for (const [key, value] of [
      ['delivery.homeCity', 'Dhaka'],
      ['delivery.homeCityCharge', 60],
      ['delivery.otherCityCharge', 129],
    ] as const) {
      await prisma.setting.create({ data: { key, value } });
    }
    const category = await prisma.category.create({ data: { name: 'Cat', slug: 'cat' } });
    productId = (
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: 'Shirt',
          slug: 'shirt',
          sku: 'S-1',
          price: '1000',
          stockQuantity: 10,
        },
      })
    ).id;
    userId = (
      await prisma.user.create({
        data: { name: 'Cust', email: 'cust@example.com', passwordHash: 'x' },
      })
    ).id;
    adminId = (
      await prisma.user.create({
        data: { name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'ADMIN' },
      })
    ).id;
  });

  it('asks only for the delivery charge now and the rest at the door', async () => {
    const order = await place();
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    const delivery = (await settings.getDeliveryConfig()).homeCityCharge;
    expect(Number(row.payment?.amount)).toBe(delivery);
    expect(Number(row.codDue)).toBe(2000);
    expect(Number(row.totalAmount)).toBe(2000 + delivery);
  });

  it('a normal order still pays in full', async () => {
    const order = await place({ ...SHIPPING, cashOnDelivery: false } as CreateOrderDto);
    const row = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(Number(row.codDue)).toBe(0);
    expect(Number(row.payment?.amount)).toBe(Number(row.totalAmount));
  });

  it('counts as a sale only once delivered, and never in the cash drawer', async () => {
    const order = await place();
    await payAdvance(order.id);
    await move(order.id, 'CONFIRMED', 'SHIPPED');

    const before = await dashboard.dailyReport();
    expect(before.online.sales).toBe(0);
    expect(before.itemsSold).toBe(0);

    await move(order.id, 'DELIVERED');
    const delivery = (await settings.getDeliveryConfig()).homeCityCharge;
    const after = await dashboard.dailyReport();
    expect(after.online.sales).toBe(1);
    expect(after.online.cashOnDelivery).toBe('2000.00');
    expect(Number(after.online.methods[0]?.total)).toBe(delivery);
    expect(Number(after.online.total)).toBe(2000 + delivery);
    expect(after.drawer.cashSales).toBe('0.00');
  });

  it('a refused parcel restores stock, keeps the advance and is no sale', async () => {
    const order = await place();
    await payAdvance(order.id);
    await move(order.id, 'CONFIRMED', 'SHIPPED');
    expect(await stock()).toBe(8);

    const result = await adminOrders.updateStatus(
      adminId,
      order.id,
      { status: 'CANCELLED', reason: 'Refused at the door' },
      null,
    );

    expect(result.refundNeeded).toBe(false);
    expect(await stock()).toBe(10);
    expect((await dashboard.dailyReport()).online.sales).toBe(0);
  });

  it('cancelling before shipping tells staff to refund the advance', async () => {
    const order = await place();
    await payAdvance(order.id);
    const result = await adminOrders.updateStatus(
      adminId,
      order.id,
      { status: 'CANCELLED', reason: 'Out of stock' },
      null,
    );
    expect(result.refundNeeded).toBe(true);
  });

  it('a shipped order paid in full still cannot be cancelled', async () => {
    const order = await place({ ...SHIPPING, cashOnDelivery: false } as CreateOrderDto);
    await payAdvance(order.id);
    await move(order.id, 'CONFIRMED', 'SHIPPED');
    await expect(
      adminOrders.updateStatus(adminId, order.id, { status: 'CANCELLED', reason: 'No' }, null),
    ).rejects.toMatchObject({ response: { code: 'INVALID_STATUS_TRANSITION' } });
  });
});
