import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderChannel, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

export type CancelSource = 'CUSTOMER' | 'ADMIN' | 'EXPIRY';

export interface CancelOptions {
  source: CancelSource;
  reason: string;
  /** The user who triggered it; null for the system (auto-expire) job. */
  actorId: string | null;
  /** Customer cancel only: the order must belong to this user, otherwise it is reported as not found. */
  ownerId?: string;
}

export interface CancelResult {
  orderNumber: string;
  restoredUnits: number;
  /** True when the customer had already paid: the refund is a manual step in V1. */
  refundNeeded: boolean;
}

const ADMIN_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PROCESSING,
  OrderStatus.CONFIRMED,
];

const CLOSED_SUBMISSION_REASON = 'Order was cancelled';

function notCancellable(message: string, code: string): ConflictException {
  return new ConflictException({ message, code });
}

/**
 * The ONE place an order gets cancelled (customer, admin, auto-expire). It runs inside the
 * caller's transaction, so the order, payment, stock and history always change together.
 */
@Injectable()
export class OrderCancellationService {
  async cancelInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    options: CancelOptions,
  ): Promise<CancelResult> {
    // Invariant for ALL payment/order changes: lock the ORDER row first.
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        channel: true,
        status: true,
        paymentStatus: true,
        expiresAt: true,
        items: {
          orderBy: [{ productId: 'asc' }, { variantId: 'asc' }],
          select: { productId: true, variantId: true, quantity: true },
        },
        payment: { select: { id: true, status: true } },
      },
    });
    if (!order || (options.ownerId !== undefined && order.userId !== options.ownerId)) {
      throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }

    this.assertEligible(order, options.source);

    const wasPaid = order.paymentStatus === PaymentStatus.APPROVED;
    const underReview = order.payment?.status === PaymentStatus.PENDING;

    // Close open submissions so no pending row can outlive its order.
    if (order.payment) {
      await tx.paymentTransaction.updateMany({
        where: { paymentId: order.payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.REJECTED,
          rejectionReason: CLOSED_SUBMISSION_REASON,
          reviewedAt: new Date(),
        },
      });
      if (underReview) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: PaymentStatus.REJECTED },
        });
      }
    }

    // Give the stock back (productId order, like order creation, so no deadlocks).
    let restoredUnits = 0;
    for (const item of order.items) {
      // An order from before the product got options has no option to restore: skip the total
      // too, or it would stop matching the sum of the options.
      await tx.product.updateMany({
        where: {
          id: item.productId,
          ...(item.variantId ? {} : { variants: { none: {} } }),
        },
        data: { stockQuantity: { increment: item.quantity } },
      });
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
      if (wasPaid) {
        // Approval counted these units as sold; never go below zero.
        await tx.$executeRaw`
          UPDATE "products" SET "soldCount" = GREATEST("soldCount" - ${item.quantity}, 0)
          WHERE id = ${item.productId}`;
      }
      restoredUnits += item.quantity;
    }

    // Give the coupon back: remove this order's usage row and free one use.
    const usage = await tx.couponUsage.findFirst({
      where: { orderId: order.id },
      select: { id: true, couponId: true },
    });
    if (usage) {
      await tx.couponUsage.delete({ where: { id: usage.id } });
      await tx.coupon.updateMany({
        where: { id: usage.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: options.reason,
        expiresAt: null,
        ...(underReview ? { paymentStatus: PaymentStatus.REJECTED } : {}),
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        note: options.reason,
        changedById: options.actorId,
      },
    });

    return { orderNumber: order.orderNumber, restoredUnits, refundNeeded: wasPaid };
  }

  private assertEligible(
    order: {
      channel: OrderChannel;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      expiresAt: Date | null;
    },
    source: CancelSource,
  ): void {
    if (source === 'ADMIN') {
      // A counter sale is complete from the start, but can still be undone at the counter.
      const voidable = order.channel === OrderChannel.POS && order.status === OrderStatus.DELIVERED;
      if (!voidable && !ADMIN_CANCELLABLE.includes(order.status)) {
        throw notCancellable('This order can no longer be cancelled', 'ORDER_NOT_CANCELLABLE');
      }
      return;
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw notCancellable('This order can no longer be cancelled', 'ORDER_NOT_CANCELLABLE');
    }
    if (order.paymentStatus === PaymentStatus.PENDING) {
      throw notCancellable(
        'Your payment is under review, so this order cannot be cancelled right now',
        'PAYMENT_UNDER_REVIEW',
      );
    }
    if (
      source === 'EXPIRY' &&
      (order.expiresAt === null || order.expiresAt.getTime() > Date.now())
    ) {
      throw notCancellable('This order has not expired', 'ORDER_NOT_EXPIRED');
    }
  }
}
