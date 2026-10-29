import { OrderStatus } from '@prisma/client';

/**
 * Manual status changes an admin may make. PENDING_PAYMENT -> PROCESSING is NOT here: only payment
 * approval does that. DELIVERED and CANCELLED are final. CANCELLED always goes through
 * OrderCancellationService (stock restore, closing submissions, history).
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};
