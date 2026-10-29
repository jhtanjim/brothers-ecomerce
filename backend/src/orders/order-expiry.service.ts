import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderCancellationService } from './order-cancellation.service';
import { TRANSACTION_MAX_WAIT_MS, TRANSACTION_TIMEOUT_MS } from './orders.constants';

const INTERVAL_MS = 5 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;
const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 5;
const EXPIRY_REASON = 'Payment window expired';

interface RunTotals {
  found: number;
  cancelled: number;
  skipped: number;
  failed: number;
}

/**
 * Cancels unpaid orders whose hold time has passed and returns their stock.
 * V1 runs on a plain timer (no scheduler dependency). Each order is cancelled in its OWN
 * transaction through OrderCancellationService, which re-checks eligibility after locking
 * the order row, so a customer paying or cancelling at the same moment simply makes us skip.
 */
@Injectable()
export class OrderExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExpiryService.name);
  private interval: NodeJS.Timeout | null = null;
  private firstRun: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cancellation: OrderCancellationService,
  ) {}

  onModuleInit(): void {
    this.firstRun = setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS);
    this.firstRun.unref();
    this.interval = setInterval(() => void this.run(), INTERVAL_MS);
    this.interval.unref();
  }

  onModuleDestroy(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.interval) clearInterval(this.interval);
    this.firstRun = null;
    this.interval = null;
  }

  async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const totals: RunTotals = { found: 0, cancelled: 0, skipped: 0, failed: 0 };
    try {
      for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch++) {
        const rows = await this.prisma.order.findMany({
          where: {
            status: OrderStatus.PENDING_PAYMENT,
            expiresAt: { lt: new Date() },
            paymentStatus: { not: PaymentStatus.PENDING },
          },
          orderBy: { expiresAt: 'asc' },
          take: BATCH_SIZE,
          select: { id: true },
        });
        totals.found += rows.length;
        for (const row of rows) {
          await this.expireOne(row.id, totals);
        }
        if (rows.length < BATCH_SIZE) break;
      }
    } catch (error) {
      this.logger.error('Expiry run failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.isRunning = false;
    }
    if (totals.found > 0) {
      this.logger.log(
        `expiry run: found=${totals.found} cancelled=${totals.cancelled} skipped=${totals.skipped} failed=${totals.failed}`,
      );
    }
  }

  private async expireOne(orderId: string, totals: RunTotals): Promise<void> {
    try {
      await this.prisma.$transaction(
        (tx) =>
          this.cancellation.cancelInTx(tx, orderId, {
            source: 'EXPIRY',
            reason: EXPIRY_REASON,
            actorId: null,
          }),
        { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: TRANSACTION_TIMEOUT_MS },
      );
      totals.cancelled++;
    } catch (error) {
      if (error instanceof ConflictException) {
        totals.skipped++;
        return;
      }
      totals.failed++;
      this.logger.error(
        `Could not expire order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
