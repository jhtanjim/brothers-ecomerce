import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { formatCents, toCents } from '../common/utils/money';
import { buildPaginationMeta, toSkipTake } from '../common/utils/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from './payments.constants';

const listSelect = {
  id: true,
  status: true,
  method: true,
  transactionId: true,
  senderPhone: true,
  screenshotPublicId: true,
  createdAt: true,
  reviewedAt: true,
  payment: {
    select: {
      amount: true,
      attemptCount: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          shippingName: true,
          shippingPhone: true,
          totalAmount: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentTransactionSelect;

const detailSelect = {
  id: true,
  status: true,
  method: true,
  transactionId: true,
  senderPhone: true,
  screenshotPublicId: true,
  rejectionReason: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: { select: { name: true } },
  payment: {
    select: {
      amount: true,
      status: true,
      attemptCount: true,
      // Bounded by the maximum number of payment attempts.
      transactions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          transactionId: true,
          rejectionReason: true,
          createdAt: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          shippingName: true,
          shippingPhone: true,
          shippingEmail: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          items: {
            orderBy: { id: 'asc' },
            select: {
              productName: true,
              productSku: true,
              size: true,
              color: true,
              quantity: true,
              totalPrice: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PaymentTransactionSelect;

type DetailRow = Prisma.PaymentTransactionGetPayload<{ select: typeof detailSelect }>;

function money(value: Prisma.Decimal): string {
  return formatCents(toCents(value));
}

function notFound(): NotFoundException {
  return new NotFoundException({
    message: 'Payment not found',
    code: 'PAYMENT_TRANSACTION_NOT_FOUND',
  });
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cloudinary: CloudinaryService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  /** Pending submissions oldest first (a review queue); other statuses newest first. */
  async list(query: AdminPaymentQueryDto) {
    const status = query.status ?? PaymentStatus.PENDING;
    const { skip, take } = toSkipTake(query.page, query.limit);
    const where: Prisma.PaymentTransactionWhereInput = { status };
    const direction = status === PaymentStatus.PENDING ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        orderBy: [{ createdAt: direction }, { id: direction }],
        skip,
        take,
        select: listSelect,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        method: row.method,
        transactionId: row.transactionId,
        senderPhone: row.senderPhone,
        hasScreenshot: row.screenshotPublicId !== null,
        amount: money(row.payment.amount),
        attemptCount: row.payment.attemptCount,
        submittedAt: row.createdAt,
        reviewedAt: row.reviewedAt,
        order: {
          id: row.payment.order.id,
          orderNumber: row.payment.order.orderNumber,
          status: row.payment.order.status,
          customerName: row.payment.order.shippingName,
          customerPhone: row.payment.order.shippingPhone,
          totalAmount: money(row.payment.order.totalAmount),
        },
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.paymentTransaction.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!row) throw notFound();
    return this.toDetail(row);
  }

  private toDetail(row: DetailRow) {
    const order = row.payment.order;
    return {
      id: row.id,
      status: row.status,
      method: row.method,
      transactionId: row.transactionId,
      senderPhone: row.senderPhone,
      // Signed link to the private screenshot: only ever returned to admins.
      screenshotUrl: row.screenshotPublicId
        ? this.cloudinary.signedPrivateImageUrl(row.screenshotPublicId)
        : null,
      rejectionReason: row.rejectionReason,
      submittedAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy?.name ?? null,
      amount: money(row.payment.amount),
      paymentStatus: row.payment.status,
      attemptCount: row.payment.attemptCount,
      submissions: row.payment.transactions.map((entry) => ({
        id: entry.id,
        status: entry.status,
        transactionId: entry.transactionId,
        rejectionReason: entry.rejectionReason,
        submittedAt: entry.createdAt,
      })),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: money(order.totalAmount),
        createdAt: order.createdAt,
        customer: { name: order.user.name, email: order.user.email },
        shipping: {
          name: order.shippingName,
          phone: order.shippingPhone,
          email: order.shippingEmail,
        },
        items: order.items.map((item) => ({
          name: item.productName,
          sku: item.productSku,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          totalPrice: money(item.totalPrice),
        })),
      },
    };
  }

  /**
   * Locks the order row FIRST (the same rule as customer submissions, so the two can never race
   * or deadlock), then requires the submission to still be pending and the order still unpaid.
   */
  private async lockPendingTransaction(tx: Prisma.TransactionClient, id: string) {
    const ref = await tx.paymentTransaction.findUnique({
      where: { id },
      select: { payment: { select: { orderId: true } } },
    });
    if (!ref) throw notFound();
    const orderId = ref.payment.orderId;

    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

    const transaction = await tx.paymentTransaction.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        status: true,
        method: true,
        transactionId: true,
        payment: {
          select: {
            id: true,
            amount: true,
            order: { select: { id: true, orderNumber: true, status: true } },
          },
        },
      },
    });

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new ConflictException({
        message: 'This payment has already been reviewed',
        code: 'PAYMENT_NOT_PENDING',
      });
    }
    if (transaction.payment.order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException({
        message: 'This order is no longer awaiting payment',
        code: 'ORDER_NOT_PAYABLE',
      });
    }
    return transaction;
  }

  async approve(adminId: string, id: string, ipAddress: string | null) {
    return this.prisma.$transaction(
      async (tx) => {
        const transaction = await this.lockPendingTransaction(tx, id);
        const order = transaction.payment.order;

        await tx.paymentTransaction.update({
          where: { id },
          data: { status: PaymentStatus.APPROVED, reviewedById: adminId, reviewedAt: new Date() },
        });
        await tx.payment.update({
          where: { id: transaction.payment.id },
          data: { status: PaymentStatus.APPROVED },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PROCESSING,
            paymentStatus: PaymentStatus.APPROVED,
            expiresAt: null,
          },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.PENDING_PAYMENT,
            toStatus: OrderStatus.PROCESSING,
            note: 'Payment approved',
            changedById: adminId,
          },
        });

        // "Popular" sorting counts units sold, so it grows only once a payment is confirmed.
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          orderBy: { productId: 'asc' },
          select: { productId: true, quantity: true },
        });
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { soldCount: { increment: item.quantity } },
          });
        }

        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.paymentApproved,
          entityType: 'PaymentTransaction',
          entityId: id,
          ipAddress,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            method: transaction.method,
            transactionId: transaction.transactionId,
            amount: money(transaction.payment.amount),
          },
        });

        return {
          id,
          status: PaymentStatus.APPROVED,
          orderId: order.id,
          orderStatus: OrderStatus.PROCESSING,
          paymentStatus: PaymentStatus.APPROVED,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  }

  async reject(adminId: string, id: string, dto: RejectPaymentDto, ipAddress: string | null) {
    const expiryHours = await this.settings.getUnpaidExpiryHours();

    return this.prisma.$transaction(
      async (tx) => {
        const transaction = await this.lockPendingTransaction(tx, id);
        const order = transaction.payment.order;

        await tx.paymentTransaction.update({
          where: { id },
          data: {
            status: PaymentStatus.REJECTED,
            rejectionReason: dto.reason,
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        });
        await tx.payment.update({
          where: { id: transaction.payment.id },
          data: { status: PaymentStatus.REJECTED },
        });
        // The order stays PENDING_PAYMENT; the customer gets a fresh window to correct the payment.
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.REJECTED,
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
          },
        });

        await this.activityLogs.record(tx, {
          adminId,
          action: ACTIVITY_ACTIONS.paymentRejected,
          entityType: 'PaymentTransaction',
          entityId: id,
          ipAddress,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            method: transaction.method,
            transactionId: transaction.transactionId,
            amount: money(transaction.payment.amount),
            reason: dto.reason,
          },
        });

        return {
          id,
          status: PaymentStatus.REJECTED,
          orderId: order.id,
          orderStatus: order.status,
          paymentStatus: PaymentStatus.REJECTED,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  }
}
