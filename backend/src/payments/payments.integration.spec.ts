import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderCancellationService } from '../orders/order-cancellation.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AdminPaymentsService } from './admin-payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

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

describe('payments (integration)', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let payments: PaymentsService;
  let admin: AdminPaymentsService;
  let cancellation: OrderCancellationService;
  let productId: string;
  let userId: string;
  let adminId: string;

  const stock = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
  const sold = async () =>
    (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).soldCount;
  const getOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

  async function placeOrder(owner: string = userId, quantity = 2) {
    const cart = await prisma.cart.upsert({
      where: { userId: owner },
      update: {},
      create: { userId: owner },
    });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
    return orders.create(owner, SHIPPING, randomUUID());
  }

  function submit(orderId: string, transactionId: string, owner: string = userId) {
    return payments.submit(
      owner,
      { orderId, transactionId, senderPhone: '01711111111' } as CreatePaymentDto,
      undefined,
    );
  }

  async function pendingTransactionId(orderId: string): Promise<string> {
    const row = await prisma.paymentTransaction.findFirstOrThrow({
      where: { payment: { orderId }, status: 'PENDING' },
    });
    return row.id;
  }

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    const settings = new SettingsService(service);
    const cloudinary = {} as CloudinaryService;
    cancellation = new OrderCancellationService();
    orders = new OrdersService(service, settings, cloudinary, cancellation);
    payments = new PaymentsService(service, settings, cloudinary);
    admin = new AdminPaymentsService(service, settings, cloudinary, new ActivityLogsService());
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
    adminId = (
      await prisma.user.create({
        data: { name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'ADMIN' },
      })
    ).id;
  });

  it('submitting puts the payment under review and stops the order expiring', async () => {
    const order = await placeOrder();
    expect((await getOrder(order.id)).expiresAt).not.toBeNull();

    const result = await submit(order.id, 'TX000001');

    expect(result.status).toBe('PENDING');
    expect(result.attemptsUsed).toBe(1);
    const row = await getOrder(order.id);
    expect(row.status).toBe('PENDING_PAYMENT');
    expect(row.paymentStatus).toBe('PENDING');
    expect(row.expiresAt).toBeNull();
  });

  it("another customer's order is reported as not found", async () => {
    const order = await placeOrder();
    const other = await prisma.user.create({
      data: { name: 'O', email: 'o@example.com', passwordHash: 'x' },
    });
    await expect(submit(order.id, 'TX000001', other.id)).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_FOUND' },
    });
  });

  it('a second submission while under review is refused', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    await expect(submit(order.id, 'TX000002')).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_SUBMITTABLE' },
    });
  });

  it('a transaction ID already in use is refused and nothing is half-written', async () => {
    const first = await placeOrder();
    await submit(first.id, 'TX000001');
    const other = await prisma.user.create({
      data: { name: 'O', email: 'o@example.com', passwordHash: 'x' },
    });
    const second = await placeOrder(other.id, 1);

    await expect(submit(second.id, 'TX000001', other.id)).rejects.toMatchObject({
      response: { code: 'TRANSACTION_ID_IN_USE' },
    });
    const row = await getOrder(second.id);
    expect(row.paymentStatus).toBe('UNPAID');
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { orderId: second.id } })).attemptCount,
    ).toBe(0);
  });

  it('a cancelled order cannot be paid', async () => {
    const order = await placeOrder();
    await prisma.$transaction((tx) =>
      cancellation.cancelInTx(tx, order.id, {
        source: 'CUSTOMER',
        reason: 'x',
        actorId: userId,
        ownerId: userId,
      }),
    );
    await expect(submit(order.id, 'TX000001')).rejects.toMatchObject({
      response: { code: 'ORDER_NOT_PAYABLE' },
    });
  });

  it('a customer cannot cancel while the payment is under review', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    await expect(
      prisma.$transaction((tx) =>
        cancellation.cancelInTx(tx, order.id, {
          source: 'CUSTOMER',
          reason: 'x',
          actorId: userId,
          ownerId: userId,
        }),
      ),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_UNDER_REVIEW' } });
    expect(await stock()).toBe(8);
  });

  it('approving moves the order to PROCESSING and counts the units as sold', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');

    const result = await admin.approve(adminId, await pendingTransactionId(order.id), null);

    expect(result).toMatchObject({ orderStatus: 'PROCESSING', paymentStatus: 'APPROVED' });
    const row = await getOrder(order.id);
    expect(row.status).toBe('PROCESSING');
    expect(row.paymentStatus).toBe('APPROVED');
    expect(row.expiresAt).toBeNull();
    expect(await sold()).toBe(2);
    expect(await prisma.activityLog.count({ where: { action: 'PAYMENT_APPROVED' } })).toBe(1);
    expect(
      await prisma.orderStatusHistory.count({
        where: { orderId: order.id, toStatus: 'PROCESSING' },
      }),
    ).toBe(1);
  });

  it('approving twice is refused and does not double-count sales', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    const id = await pendingTransactionId(order.id);
    await admin.approve(adminId, id, null);

    await expect(admin.approve(adminId, id, null)).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_PENDING' },
    });
    expect(await sold()).toBe(2);
  });

  it('rejecting keeps the order awaiting payment, saves the reason and restarts the expiry', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');

    const result = await admin.reject(
      adminId,
      await pendingTransactionId(order.id),
      { reason: 'Wrong amount' },
      null,
    );

    expect(result).toMatchObject({ orderStatus: 'PENDING_PAYMENT', paymentStatus: 'REJECTED' });
    const row = await getOrder(order.id);
    expect(row.status).toBe('PENDING_PAYMENT');
    expect(row.paymentStatus).toBe('REJECTED');
    expect(row.expiresAt).not.toBeNull();
    const tx = await prisma.paymentTransaction.findFirstOrThrow({
      where: { payment: { orderId: order.id } },
    });
    expect(tx.rejectionReason).toBe('Wrong amount');
    expect(await sold()).toBe(0);
  });

  it('after a rejection the customer can resubmit with a new transaction ID', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    await admin.reject(
      adminId,
      await pendingTransactionId(order.id),
      { reason: 'Wrong amount' },
      null,
    );

    const again = await submit(order.id, 'TX000002');

    expect(again.status).toBe('PENDING');
    expect(again.attemptsUsed).toBe(2);
  });

  it('after 3 rejected attempts the 4th submission is refused', async () => {
    const order = await placeOrder();
    for (const code of ['TX000001', 'TX000002', 'TX000003']) {
      await submit(order.id, code);
      await admin.reject(
        adminId,
        await pendingTransactionId(order.id),
        { reason: 'Not received' },
        null,
      );
    }
    await expect(submit(order.id, 'TX000004')).rejects.toMatchObject({
      response: { code: 'PAYMENT_ATTEMPTS_EXHAUSTED' },
    });
  });

  it('approving a cancelled order is refused', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    const id = await pendingTransactionId(order.id);
    // Admin cancel closes the open submission, so approve must fail either way.
    await prisma.$transaction((tx) =>
      cancellation.cancelInTx(tx, order.id, { source: 'ADMIN', reason: 'test', actorId: adminId }),
    );
    await expect(admin.approve(adminId, id, null)).rejects.toMatchObject({
      response: { code: expect.stringMatching(/PAYMENT_NOT_PENDING|ORDER_NOT_PAYABLE/) },
    });
    expect(await sold()).toBe(0);
  });

  it('cancelling a paid order restores stock and sold count and flags a refund', async () => {
    const order = await placeOrder();
    await submit(order.id, 'TX000001');
    await admin.approve(adminId, await pendingTransactionId(order.id), null);
    expect(await sold()).toBe(2);

    const result = await prisma.$transaction((tx) =>
      cancellation.cancelInTx(tx, order.id, {
        source: 'ADMIN',
        reason: 'Customer request',
        actorId: adminId,
      }),
    );

    expect(result.refundNeeded).toBe(true);
    expect(await sold()).toBe(0);
    expect(await stock()).toBe(10);
    expect((await getOrder(order.id)).status).toBe('CANCELLED');
  });
});
