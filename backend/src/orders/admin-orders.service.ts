import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrderQueryDto } from './dto/admin-order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderCancellationService } from './order-cancellation.service';
import { ALLOWED_TRANSITIONS } from './order-transitions';
import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from './orders.constants';

/** Light payload for the admin list: no items, payment or history. */
const listSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  totalAmount: true,
  createdAt: true,
  shippingName: true,
  shippingPhone: true,
  user: { select: { email: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

const detailSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  subtotal: true,
  discountAmount: true,
  couponDiscount: true,
  couponCode: true,
  deliveryCharge: true,
  totalAmount: true,
  shippingName: true,
  shippingPhone: true,
  shippingEmail: true,
  shippingAddress: true,
  shippingCity: true,
  shippingArea: true,
  shippingPostalCode: true,
  notes: true,
  cancellationReason: true,
  cancelledAt: true,
  expiresAt: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      productName: true,
      productSku: true,
      productImageUrl: true,
      unitPrice: true,
      quantity: true,
      discountAmount: true,
      totalPrice: true,
    },
  },
  payment: {
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      attemptCount: true,
      // Bounded by the maximum number of payment attempts.
      transactions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          method: true,
          status: true,
          transactionId: true,
          rejectionReason: true,
          createdAt: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
      changedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type DetailRow = Prisma.OrderGetPayload<{ select: typeof detailSelect }>;

function money(value: Prisma.Decimal): string {
  return formatCents(toCents(value));
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancellation: OrderCancellationService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async list(query: AdminOrderQueryDto) {
    const { skip, take } = toSkipTake(query.page, query.limit);
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.search ? { orderNumber: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        select: listSelect,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: money(row.totalAmount),
        itemCount: row._count.items,
        customerName: row.shippingName,
        customerPhone: row.shippingPhone,
        customerEmail: row.user.email,
        createdAt: row.createdAt,
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  /**
   * Locks the order row FIRST (same rule as every order/payment change), validates the transition
   * against the current status, then applies it with its history row and activity log atomically.
   */
  async updateStatus(
    adminId: string,
    id: string,
    dto: UpdateOrderStatusDto,
    ipAddress: string | null,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${id} FOR UPDATE`;
        const order = await tx.order.findUnique({
          where: { id },
          select: { id: true, orderNumber: true, status: true, paymentStatus: true },
        });
        if (!order) {
          throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
        }
        if (!ALLOWED_TRANSITIONS[order.status].includes(dto.status)) {
          throw new ConflictException({
            message: `An order that is ${order.status} cannot be changed to ${dto.status}`,
            code: 'INVALID_STATUS_TRANSITION',
          });
        }

        if (dto.status === OrderStatus.CANCELLED) {
          const reason = dto.reason as string;
          const result = await this.cancellation.cancelInTx(tx, id, {
            source: 'ADMIN',
            reason,
            actorId: adminId,
          });
          await this.activityLogs.record(tx, {
            adminId,
            action: ACTIVITY_ACTIONS.orderCancelled,
            entityType: 'Order',
            entityId: id,
            ipAddress,
            metadata: {
              orderNumber: order.orderNumber,
              fromStatus: order.status,
              reason,
              refundNeeded: result.refundNeeded,
            },
          });
          return {
            id,
            orderNumber: order.orderNumber,
            status: OrderStatus.CANCELLED,
            paymentStatus: order.paymentStatus,
            refundNeeded: result.refundNeeded,
          };
        }

        await tx.order.update({ where: { id }, data: { status: dto.status } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            fromStatus: order.status,
            toStatus: dto.status,
            note: dto.reason ?? null,
            changedById: adminId,
          },
        });
        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.orderStatusChanged,
          entityType: 'Order',
          entityId: id,
          ipAddress,
          metadata: {
            orderNumber: order.orderNumber,
            fromStatus: order.status,
            toStatus: dto.status,
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        });
        return {
          id,
          orderNumber: order.orderNumber,
          status: dto.status,
          paymentStatus: order.paymentStatus,
          refundNeeded: false,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  }

  async findOne(id: string) {
    const row = await this.prisma.order.findUnique({ where: { id }, select: detailSelect });
    if (!row) {
      throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    return this.toDetail(row);
  }

  private toDetail(order: DetailRow) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: money(order.subtotal),
      discountAmount: money(order.discountAmount),
      couponDiscount: money(order.couponDiscount),
      couponCode: order.couponCode,
      deliveryCharge: money(order.deliveryCharge),
      totalAmount: money(order.totalAmount),
      customer: { name: order.user.name, email: order.user.email },
      shipping: {
        name: order.shippingName,
        phone: order.shippingPhone,
        email: order.shippingEmail,
        address: order.shippingAddress,
        city: order.shippingCity,
        area: order.shippingArea,
        postalCode: order.shippingPostalCode,
      },
      notes: order.notes,
      cancellationReason: order.cancellationReason,
      cancelledAt: order.cancelledAt,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.productName,
        sku: item.productSku,
        imageUrl: item.productImageUrl,
        unitPrice: money(item.unitPrice),
        quantity: item.quantity,
        discountAmount: money(item.discountAmount),
        totalPrice: money(item.totalPrice),
      })),
      payment: order.payment
        ? {
            id: order.payment.id,
            method: order.payment.method,
            status: order.payment.status,
            amount: money(order.payment.amount),
            attemptCount: order.payment.attemptCount,
            submissions: order.payment.transactions.map((entry) => ({
              id: entry.id,
              method: entry.method,
              status: entry.status,
              transactionId: entry.transactionId,
              rejectionReason: entry.rejectionReason,
              submittedAt: entry.createdAt,
            })),
          }
        : null,
      timeline: order.statusHistory.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        changedBy: entry.changedBy?.name ?? null,
        createdAt: entry.createdAt,
      })),
    };
  }
}
