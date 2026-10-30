import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  ORDER_NUMBER_MAX_ATTEMPTS,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from './orders.constants';
import { generateOrderNumber, isOrderNumberCollision } from './orders.service';

const RETURN_PREFIX = 'RET';

const returnSelect = {
  id: true,
  returnNumber: true,
  reason: true,
  refundAmount: true,
  refundMethod: true,
  restocked: true,
  exchangeOrderId: true,
  createdAt: true,
  order: { select: { id: true, orderNumber: true, shippingName: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      amount: true,
      orderItem: { select: { productName: true, size: true, color: true } },
    },
  },
} satisfies Prisma.OrderReturnSelect;

type ReturnRow = Prisma.OrderReturnGetPayload<{ select: typeof returnSelect }>;

function toView(row: ReturnRow) {
  return {
    id: row.id,
    returnNumber: row.returnNumber,
    reason: row.reason,
    refundAmount: formatCents(toCents(row.refundAmount)),
    refundMethod: row.refundMethod,
    restocked: row.restocked,
    exchangeOrderId: row.exchangeOrderId,
    createdAt: row.createdAt,
    orderId: row.order.id,
    orderNumber: row.order.orderNumber,
    customerName: row.order.shippingName,
    items: row.items.map((item) => ({
      id: item.id,
      name: item.orderItem.productName,
      size: item.orderItem.size,
      color: item.orderItem.color,
      quantity: item.quantity,
      amount: formatCents(toCents(item.amount)),
    })),
  };
}

/**
 * What the units being returned are worth: what was really paid for them, including their share
 * of any discount on the whole sale. Bringing back the last units of a line refunds exactly what
 * is left, so rounding can never pay out more or less than the line in total.
 */
export function refundForLine(line: {
  lineTotalCents: number;
  itemsTotalCents: number;
  saleDiscountCents: number;
  orderedQuantity: number;
  returnedQuantity: number;
  returnedCents: number;
  quantity: number;
}): number {
  const discountShare =
    line.itemsTotalCents > 0
      ? Math.round((line.saleDiscountCents * line.lineTotalCents) / line.itemsTotalCents)
      : 0;
  const paidCents = line.lineTotalCents - discountShare;
  if (line.returnedQuantity + line.quantity >= line.orderedQuantity) {
    return Math.max(0, paidCents - line.returnedCents);
  }
  return Math.round((paidCents * line.quantity) / line.orderedQuantity);
}

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async findOne(id: string) {
    const row = await this.prisma.orderReturn.findUnique({ where: { id }, select: returnSelect });
    if (!row) {
      throw new NotFoundException({ message: 'Return not found', code: 'RETURN_NOT_FOUND' });
    }
    return toView(row);
  }

  async create(
    adminId: string,
    orderId: string,
    dto: CreateReturnDto,
    idempotencyKey: string,
    ipAddress: string | null,
  ) {
    const ids = dto.items.map((item) => item.orderItemId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        message: 'The same item is listed twice',
        code: 'RETURN_DUPLICATE_ITEM',
      });
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const id = await this.prisma.$transaction(
          (tx) => this.placeReturn(tx, adminId, orderId, dto, idempotencyKey, ipAddress),
          { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
        );
        return await this.findOne(id);
      } catch (error) {
        if (attempt < ORDER_NUMBER_MAX_ATTEMPTS && isOrderNumberCollision(error, 'returnNumber')) {
          continue;
        }
        throw error;
      }
    }
  }

  private async placeReturn(
    tx: Prisma.TransactionClient,
    adminId: string,
    orderId: string,
    dto: CreateReturnDto,
    idempotencyKey: string,
    ipAddress: string | null,
  ): Promise<string> {
    const existing = await tx.orderReturn.findUnique({
      where: { adminId_idempotencyKey: { adminId, idempotencyKey } },
      select: { id: true },
    });
    if (existing) return existing.id;

    // Invariant for ALL payment/order changes: lock the ORDER row first.
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        couponDiscount: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            totalPrice: true,
            returnItems: { select: { quantity: true, amount: true } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    if (order.status !== OrderStatus.DELIVERED || order.paymentStatus !== PaymentStatus.APPROVED) {
      throw new ConflictException({
        message: 'Only paid, completed orders can be returned',
        code: 'RETURN_NOT_ALLOWED',
      });
    }

    const itemsTotalCents = order.items.reduce((sum, item) => sum + toCents(item.totalPrice), 0);
    const saleDiscountCents = toCents(order.couponDiscount);
    const lines = dto.items.map((requested) => {
      const item = order.items.find((entry) => entry.id === requested.orderItemId);
      if (!item) {
        throw new BadRequestException({
          message: 'That item is not part of this order',
          code: 'RETURN_ITEM_NOT_IN_ORDER',
        });
      }
      const returnedQuantity = item.returnItems.reduce((sum, entry) => sum + entry.quantity, 0);
      if (requested.quantity > item.quantity - returnedQuantity) {
        throw new ConflictException({
          message: 'That is more than can still be returned for this item',
          code: 'RETURN_QUANTITY_TOO_HIGH',
        });
      }
      const amountCents = refundForLine({
        lineTotalCents: toCents(item.totalPrice),
        itemsTotalCents,
        saleDiscountCents,
        orderedQuantity: item.quantity,
        returnedQuantity,
        returnedCents: item.returnItems.reduce((sum, entry) => sum + toCents(entry.amount), 0),
        quantity: requested.quantity,
      });
      return { item, quantity: requested.quantity, amountCents };
    });

    // Fixed order, like sales, so concurrent stock changes lock products in the same order.
    const sorted = [...lines].sort(
      (a, b) =>
        a.item.productId.localeCompare(b.item.productId) ||
        (a.item.variantId ?? '').localeCompare(b.item.variantId ?? ''),
    );
    for (const { item, quantity } of sorted) {
      if (dto.restock) {
        // An order from before the product got options has no option to restore: skip the total
        // too, or it would stop matching the sum of the options.
        await tx.product.updateMany({
          where: { id: item.productId, ...(item.variantId ? {} : { variants: { none: {} } }) },
          data: { stockQuantity: { increment: quantity } },
        });
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: quantity } },
          });
        }
      }
      await tx.$executeRaw`
        UPDATE "products" SET "soldCount" = GREATEST("soldCount" - ${quantity}, 0)
        WHERE id = ${item.productId}`;
    }

    const refundCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
    const created = await tx.orderReturn.create({
      data: {
        returnNumber: generateOrderNumber(RETURN_PREFIX),
        orderId,
        adminId,
        reason: dto.reason,
        refundAmount: formatCents(refundCents),
        refundMethod: dto.refundMethod ?? null,
        restocked: dto.restock,
        idempotencyKey,
        items: {
          create: lines.map((line) => ({
            orderItemId: line.item.id,
            quantity: line.quantity,
            amount: formatCents(line.amountCents),
          })),
        },
      },
      select: { id: true, returnNumber: true },
    });

    await this.activityLogs.record(tx, {
      adminId,
      action: ACTIVITY_ACTIONS.orderReturned,
      entityType: 'OrderReturn',
      entityId: created.id,
      metadata: {
        orderNumber: order.orderNumber,
        returnNumber: created.returnNumber,
        amount: formatCents(refundCents),
        refundMethod: dto.refundMethod ?? 'EXCHANGE',
      },
      ipAddress,
    });
    return created.id;
  }
}
