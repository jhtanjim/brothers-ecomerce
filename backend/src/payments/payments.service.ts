import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { detectImageType } from '../uploads/image-signature';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_PROOF_FOLDER,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from './payments.constants';

export interface PaymentSubmissionView {
  id: string;
  paymentId: string;
  status: PaymentStatus;
  transactionId: string;
  hasScreenshot: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  createdAt: Date;
}

function orderNotFound(): NotFoundException {
  return new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Records a customer's payment proof (first submission or a resubmission after a rejection).
   * Atomic: any failure leaves the order, the payment and the stored screenshot untouched.
   */
  async submit(
    userId: string,
    dto: CreatePaymentDto,
    file: Express.Multer.File | undefined,
  ): Promise<PaymentSubmissionView> {
    const config = await this.settings.getPaymentConfig();

    // Cheap ownership check before any upload work.
    const owned = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
      select: { id: true },
    });
    if (!owned) throw orderNotFound();

    let proofPublicId: string | null = null;
    if (file) {
      if (!config.screenshotEnabled) {
        throw new BadRequestException({
          message: 'Payment screenshots are not accepted',
          code: 'SCREENSHOT_DISABLED',
        });
      }
      if (detectImageType(file.buffer) === null) {
        throw new BadRequestException({
          message: 'The screenshot must be a JPEG, PNG or WebP image',
          code: 'INVALID_IMAGE',
        });
      }
      const uploaded = await this.cloudinary.uploadPrivateImage(file.buffer, PAYMENT_PROOF_FOLDER);
      proofPublicId = uploaded.publicId;
    }

    try {
      return await this.prisma.$transaction(
        (tx) => this.recordSubmission(tx, userId, dto, proofPublicId, config.maxAttempts),
        { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
      );
    } catch (error) {
      if (proofPublicId) await this.cloudinary.deletePrivateImage(proofPublicId);
      // The only unique constraint this transaction can break is (method, transactionId) for active IDs.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          message: 'This transaction ID has already been used',
          code: 'TRANSACTION_ID_IN_USE',
        });
      }
      throw error;
    }
  }

  private async recordSubmission(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreatePaymentDto,
    proofPublicId: string | null,
    maxAttempts: number,
  ): Promise<PaymentSubmissionView> {
    // Invariant for ALL payment changes (submit, approve, reject): lock the ORDER row first.
    // That serializes them per order, so they can never race or deadlock.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "orders" WHERE id = ${dto.orderId} AND "userId" = ${userId} FOR UPDATE`;
    if (locked.length === 0) throw orderNotFound();

    const order = await tx.order.findUniqueOrThrow({
      where: { id: dto.orderId },
      select: {
        status: true,
        expiresAt: true,
        payment: { select: { id: true, method: true, status: true, attemptCount: true } },
      },
    });

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException({
        message: 'This order can no longer be paid',
        code: 'ORDER_NOT_PAYABLE',
      });
    }
    if (order.expiresAt !== null && order.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException({ message: 'This order has expired', code: 'ORDER_EXPIRED' });
    }

    const payment = order.payment;
    if (!payment) {
      throw new ConflictException({
        message: 'This order has no payment to submit',
        code: 'PAYMENT_NOT_FOUND',
      });
    }
    if (payment.status !== PaymentStatus.UNPAID && payment.status !== PaymentStatus.REJECTED) {
      throw new ConflictException({
        message:
          payment.status === PaymentStatus.PENDING
            ? 'Your payment is already under review'
            : 'This order is already paid',
        code: 'PAYMENT_NOT_SUBMITTABLE',
      });
    }
    if (payment.attemptCount >= maxAttempts) {
      throw new ConflictException({
        message: 'You have used all payment attempts for this order. Please contact support.',
        code: 'PAYMENT_ATTEMPTS_EXHAUSTED',
      });
    }

    const transaction = await tx.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        method: payment.method,
        transactionId: dto.transactionId,
        senderPhone: dto.senderPhone,
        screenshotPublicId: proofPublicId,
        status: PaymentStatus.PENDING,
      },
      select: { id: true, createdAt: true },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PENDING, attemptCount: { increment: 1 } },
    });
    // While a payment is under review the order must not auto-expire: stock stays held.
    await tx.order.update({
      where: { id: dto.orderId },
      data: { paymentStatus: PaymentStatus.PENDING, expiresAt: null },
    });

    return {
      id: transaction.id,
      paymentId: payment.id,
      status: PaymentStatus.PENDING,
      transactionId: dto.transactionId,
      hasScreenshot: proofPublicId !== null,
      attemptsUsed: payment.attemptCount + 1,
      maxAttempts,
      createdAt: transaction.createdAt,
    };
  }
}
