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

const POS_ORDER_PREFIX = 'POS';
const WALK_IN_NAME = 'Walk-in customer';
const IN_STORE = 'In store';
/** Counter sales have no delivery. */
const NO_DELIVERY = { homeCity: '', homeCityCharge: 0, otherCityCharge: 0, freeThreshold: null };

/** Sales at the shop counter: paid in cash and handed over on the spot. */
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
        throw error;
      }
    }
  }

  /** Cancels a counter sale and puts its stock back. Giving the cash back is up to the shop. */
  async voidSale(adminId: string, id: string, reason: string, ipAddress: string | null) {
    await this.prisma.$transaction(
      async (tx) => {
        const sale = await tx.order.findUnique({ where: { id }, select: { channel: true } });
        if (sale?.channel !== OrderChannel.POS) {
          throw new NotFoundException({ message: 'Sale not found', code: 'POS_SALE_NOT_FOUND' });
        }
        const result = await this.cancellation.cancelInTx(tx, id, {
          source: 'ADMIN',
          reason,
          actorId: adminId,
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

    const cashCents = toCents(dto.cashReceived);
    if (cashCents < pricing.totalCents) {
      throw new ConflictException({
        message: 'The cash received is less than the total',
        code: 'POS_CASH_TOO_LOW',
      });
    }

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
        cashReceived: formatCents(cashCents),
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
            method: PaymentMethod.CASH,
            amount: formatCents(pricing.totalCents),
            status: PaymentStatus.APPROVED,
          },
        },
      },
      select: { id: true, orderNumber: true },
    });

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
