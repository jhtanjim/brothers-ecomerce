import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderChannel, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrdersService } from './admin-orders.service';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { OrderCancellationService } from './order-cancellation.service';
import { calculateOrderPricing } from './order-pricing';
import {
  ORDER_NUMBER_MAX_ATTEMPTS,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from './orders.constants';
import { generateOrderNumber, isOrderNumberCollision, OrdersService } from './orders.service';
import { phoneVariants } from './phone-variants';

const POS_ORDER_PREFIX = 'POS';
const WALK_IN_NAME = 'Walk-in customer';
const IN_STORE = 'In store';
const RECENT_PURCHASES = 5;
/** Counter sales have no delivery. */
const NO_DELIVERY = { homeCity: '', homeCityCharge: 0, otherCityCharge: 0, freeThreshold: null };

/** Sales at the shop counter: paid on the spot and handed over. */
@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly adminOrders: AdminOrdersService,
    private readonly cancellation: OrderCancellationService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async createSale(adminId: string, dto: CreatePosSaleDto, idempotencyKey: string) {
    const keys = dto.items.map((item) => `${item.productId}:${item.variantId ?? ''}`);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException({
        message: 'The same item is listed twice',
        code: 'POS_DUPLICATE_ITEM',
      });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const orderId = await this.prisma.$transaction(
          (tx) => this.placeSale(tx, adminId, dto, idempotencyKey),
          { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
        );
        return await this.adminOrders.findOne(orderId);
      } catch (error) {
        if (attempt < ORDER_NUMBER_MAX_ATTEMPTS && isOrderNumberCollision(error)) continue;
        // Two sales raced with one ID: the database's unique index stopped the second.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target ?? '').includes('transactionId')
        ) {
          throw this.transactionUsed();
        }
        throw error;
      }
    }
  }

  /** What a customer has bought, shop and online. Only paid orders that were not cancelled. */
  async customerHistory(phone: string) {
    const where: Prisma.OrderWhereInput = {
      shippingPhone: { in: phoneVariants(phone) },
      paymentStatus: PaymentStatus.APPROVED,
      status: { not: OrderStatus.CANCELLED },
    };
    const [summary, recent, named] = await Promise.all([
      this.prisma.order.aggregate({ where, _count: true, _sum: { totalAmount: true } }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: RECENT_PURCHASES,
        select: {
          id: true,
          orderNumber: true,
          channel: true,
          createdAt: true,
          totalAmount: true,
          items: { select: { productName: true, size: true, color: true, quantity: true } },
        },
      }),
      this.prisma.order.findFirst({
        where: { ...where, shippingName: { not: WALK_IN_NAME } },
        orderBy: { createdAt: 'desc' },
        select: { shippingName: true },
      }),
    ]);
    return {
      name: named?.shippingName ?? null,
      purchaseCount: summary._count,
      totalSpent: formatCents(toCents(summary._sum.totalAmount ?? 0)),
      recent: recent.map((order) => ({
        ...order,
        totalAmount: formatCents(toCents(order.totalAmount)),
      })),
    };
  }

  /** Cancels a counter sale and puts its stock back. Giving the cash back is up to the shop. */
  async voidSale(adminId: string, id: string, reason: string, ipAddress: string | null) {
    await this.prisma.$transaction(
      async (tx) => {
        const sale = await tx.order.findUnique({
          where: { id },
          select: { channel: true, _count: { select: { returns: true } } },
        });
        if (sale?.channel !== OrderChannel.POS) {
          throw new NotFoundException({ message: 'Sale not found', code: 'POS_SALE_NOT_FOUND' });
        }
        // Those items are already back; cancelling would put them in stock twice.
        if (sale._count.returns > 0) {
          throw new ConflictException({
            message: 'This sale has returns, so it cannot be cancelled',
            code: 'POS_SALE_HAS_RETURNS',
          });
        }
        const result = await this.cancellation.cancelInTx(tx, id, {
          source: 'ADMIN',
          reason,
          actorId: adminId,
        });
        // Cancelling an exchange gives the customer their credit back.
        await tx.orderReturn.updateMany({
          where: { exchangeOrderId: id },
          data: { exchangeOrderId: null },
        });
        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.posSaleVoided,
          entityType: 'Order',
          entityId: id,
          metadata: { orderNumber: result.orderNumber, reason },
          ipAddress,
        });
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
    return this.adminOrders.findOne(id);
  }

  /** The value of an unused exchange. A refunded return has already been paid out. */
  private async creditFor(tx: Prisma.TransactionClient, returnId: string): Promise<number> {
    const credit = await tx.orderReturn.findFirst({
      where: { id: returnId, refundMethod: null, exchangeOrderId: null },
      select: { refundAmount: true },
    });
    if (!credit) throw this.creditInvalid();
    return toCents(credit.refundAmount);
  }

  private creditInvalid(): ConflictException {
    return new ConflictException({
      message: 'This exchange credit does not exist or has already been used',
      code: 'POS_CREDIT_INVALID',
    });
  }

  /** Same rule as online payments: an ID that was not rejected cannot be used again. */
  private async assertTransactionUnused(
    tx: Prisma.TransactionClient,
    method: PaymentMethod,
    transactionId: string,
  ): Promise<void> {
    const used = await tx.paymentTransaction.findFirst({
      where: { method, transactionId, status: { not: PaymentStatus.REJECTED } },
      select: { id: true },
    });
    if (used) throw this.transactionUsed();
  }

  private transactionUsed(): ConflictException {
    return new ConflictException({
      message: 'This transaction ID has already been used',
      code: 'POS_TRANSACTION_ID_USED',
    });
  }

  private async placeSale(
    tx: Prisma.TransactionClient,
    adminId: string,
    dto: CreatePosSaleDto,
    idempotencyKey: string,
  ): Promise<string> {
    // A repeated submit (double click, retry after a lost connection) returns the first sale.
    const existing = await tx.order.findUnique({
      where: { userId_idempotencyKey: { userId: adminId, idempotencyKey } },
      select: { id: true },
    });
    if (existing) return existing.id;

    // Fixed order, like online checkout, so concurrent sales lock products in the same order.
    const items = [...dto.items].sort(
      (a, b) =>
        a.productId.localeCompare(b.productId) ||
        (a.variantId ?? '').localeCompare(b.variantId ?? ''),
    );
    const reserved: Awaited<ReturnType<OrdersService['reserveLine']>>[] = [];
    for (const item of items) {
      reserved.push(
        await this.orders.reserveLine(tx, {
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }),
      );
    }

    const inputs = reserved.map((line) => line.input);
    const before = calculateOrderPricing(inputs, IN_STORE, NO_DELIVERY);
    const discountCents = toCents(dto.discount ?? 0);
    if (discountCents > before.totalCents) {
      throw new BadRequestException({
        message: 'The discount is more than the total',
        code: 'POS_DISCOUNT_TOO_LARGE',
      });
    }
    const pricing = calculateOrderPricing(inputs, IN_STORE, NO_DELIVERY, discountCents);

    const creditCents = dto.exchangeReturnId ? await this.creditFor(tx, dto.exchangeReturnId) : 0;
    const dueCents = Math.max(0, pricing.totalCents - creditCents);
    const isCash = dto.paymentMethod === PaymentMethod.CASH;
    // Credit above the new total goes back to the customer as cash.
    if (!isCash && creditCents >= pricing.totalCents) {
      throw new ConflictException({
        message: 'The exchange credit covers this sale. Choose cash.',
        code: 'POS_CREDIT_NEEDS_CASH',
      });
    }
    const cashCents = isCash ? toCents(dto.cashReceived ?? 0) : null;
    if (cashCents !== null && cashCents < dueCents) {
      throw new ConflictException({
        message: 'The cash received is less than the total',
        code: 'POS_CASH_TOO_LOW',
      });
    }
    const transactionId = isCash ? null : dto.transactionId;
    if (!isCash && !transactionId) {
      throw new BadRequestException({
        message: 'Enter the transaction ID',
        code: 'POS_TRANSACTION_ID_REQUIRED',
      });
    }
    if (transactionId) await this.assertTransactionUnused(tx, dto.paymentMethod, transactionId);

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(POS_ORDER_PREFIX),
        userId: adminId,
        channel: OrderChannel.POS,
        subtotal: formatCents(pricing.subtotalCents),
        discountAmount: formatCents(pricing.discountCents),
        couponDiscount: formatCents(pricing.couponDiscountCents),
        deliveryCharge: formatCents(0),
        totalAmount: formatCents(pricing.totalCents),
        cashReceived: cashCents === null ? null : formatCents(cashCents),
        exchangeCredit: formatCents(creditCents),
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.APPROVED,
        shippingName: dto.customerName || WALK_IN_NAME,
        shippingPhone: dto.customerPhone ?? '',
        shippingEmail: '',
        shippingAddress: IN_STORE,
        shippingCity: IN_STORE,
        shippingArea: '',
        shippingPostalCode: '',
        idempotencyKey,
        items: {
          create: pricing.lines.map((line, index) => {
            const snapshot = reserved[index]?.snapshot;
            return {
              productId: line.productId,
              productName: snapshot?.name ?? '',
              productSku: snapshot?.sku ?? '',
              productImageUrl: snapshot?.imageUrl ?? null,
              variantId: snapshot?.variantId ?? null,
              size: snapshot?.size ?? null,
              color: snapshot?.color ?? null,
              unitCost: snapshot?.unitCost ?? null,
              unitPrice: formatCents(line.unitPriceCents),
              quantity: line.quantity,
              discountAmount: formatCents(line.discountCents),
              totalPrice: formatCents(line.totalCents),
            };
          }),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.DELIVERED,
            note: 'Sold at the shop',
            changedById: adminId,
          },
        },
        payment: {
          create: {
            method: dto.paymentMethod,
            amount: formatCents(dueCents),
            status: PaymentStatus.APPROVED,
            ...(transactionId
              ? {
                  transactions: {
                    create: {
                      method: dto.paymentMethod,
                      transactionId,
                      status: PaymentStatus.APPROVED,
                      reviewedById: adminId,
                      reviewedAt: new Date(),
                    },
                  },
                }
              : {}),
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

    if (dto.exchangeReturnId) {
      // Conditional, so two sales racing for one credit cannot both use it.
      const claimed = await tx.orderReturn.updateMany({
        where: { id: dto.exchangeReturnId, refundMethod: null, exchangeOrderId: null },
        data: { exchangeOrderId: order.id },
      });
      if (claimed.count === 0) throw this.creditInvalid();
    }

    // Same as an approved online payment: the units count as sold.
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { increment: item.quantity } },
      });
    }

    await this.activityLogs.record(tx, {
      adminId,
      action: ACTIVITY_ACTIONS.posSaleCreated,
      entityType: 'Order',
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber, total: formatCents(pricing.totalCents) },
    });
    return order.id;
  }
}
