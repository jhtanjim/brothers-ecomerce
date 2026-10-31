import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const ACTIVITY_ACTIONS = {
  paymentApproved: 'PAYMENT_APPROVED',
  paymentRejected: 'PAYMENT_REJECTED',
  orderStatusChanged: 'ORDER_STATUS_CHANGED',
  orderCancelled: 'ORDER_CANCELLED',
  posSaleCreated: 'POS_SALE_CREATED',
  posSaleVoided: 'POS_SALE_VOIDED',
  orderReturned: 'ORDER_RETURNED',
  stockPurchased: 'STOCK_PURCHASED',
  couponCreated: 'COUPON_CREATED',
  couponUpdated: 'COUPON_UPDATED',
  couponStatusChanged: 'COUPON_STATUS_CHANGED',
  couponDeleted: 'COUPON_DELETED',
  settingsUpdated: 'SETTINGS_UPDATED',
  customerSuspended: 'CUSTOMER_SUSPENDED',
  customerReactivated: 'CUSTOMER_REACTIVATED',
} as const;

export interface ActivityLogEntry {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Any Prisma client or transaction client: logging works inside the caller's transaction. */
type LogDb = Pick<Prisma.TransactionClient, 'activityLog'>;

@Injectable()
export class ActivityLogsService {
  /**
   * Records one admin action. Pass the transaction client of the action itself, so the log is
   * saved atomically with the change it describes (no action without a log, no log without an action).
   */
  async record(db: LogDb, entry: ActivityLogEntry): Promise<void> {
    await db.activityLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  }
}
