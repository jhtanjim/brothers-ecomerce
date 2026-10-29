import { ActiveStatus, CouponType, Prisma } from '@prisma/client';
import { toCents } from '../common/utils/money';
import type { MoneyInput } from '../common/utils/money';

export type CouponRejectionCode =
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_MINIMUM_NOT_MET'
  | 'COUPON_USAGE_LIMIT_REACHED'
  | 'COUPON_USER_LIMIT_REACHED'
  | 'COUPON_NOT_APPLICABLE';

/** The coupon fields the rules need (a subset of the Coupon row). */
export interface CouponRule {
  type: CouponType;
  value: MoneyInput;
  minimumOrderAmount: MoneyInput | null;
  maximumDiscount: MoneyInput | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  status: ActiveStatus;
}

export type CouponEvaluation =
  { ok: true; discountCents: number } | { ok: false; code: CouponRejectionCode; message: string };

function reject(code: CouponRejectionCode, message: string): CouponEvaluation {
  return { ok: false, code, message };
}

/**
 * Single source of truth for coupon rules. Pure: no database access, integer cents only.
 * `payableCents` is the amount after product-level discounts and before delivery.
 * `userUsageCount` is how many live orders this customer already used the coupon on.
 */
export function evaluateCoupon(
  coupon: CouponRule,
  payableCents: number,
  userUsageCount: number,
  now: Date = new Date(),
): CouponEvaluation {
  if (coupon.status !== ActiveStatus.ACTIVE) {
    return reject('COUPON_INACTIVE', 'This coupon is not active');
  }
  if (coupon.startsAt !== null && coupon.startsAt.getTime() > now.getTime()) {
    return reject('COUPON_NOT_STARTED', 'This coupon is not valid yet');
  }
  if (coupon.expiresAt !== null && coupon.expiresAt.getTime() <= now.getTime()) {
    return reject('COUPON_EXPIRED', 'This coupon has expired');
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return reject('COUPON_USAGE_LIMIT_REACHED', 'This coupon has reached its usage limit');
  }
  if (coupon.perUserLimit !== null && userUsageCount >= coupon.perUserLimit) {
    return reject(
      'COUPON_USER_LIMIT_REACHED',
      'You have already used this coupon the maximum number of times',
    );
  }
  if (coupon.minimumOrderAmount !== null && payableCents < toCents(coupon.minimumOrderAmount)) {
    return reject(
      'COUPON_MINIMUM_NOT_MET',
      `This coupon needs a minimum order of ${new Prisma.Decimal(coupon.minimumOrderAmount).toFixed(2)}`,
    );
  }

  let discountCents =
    coupon.type === CouponType.PERCENTAGE
      ? new Prisma.Decimal(coupon.value).mul(payableCents).div(100).floor().toNumber()
      : toCents(coupon.value);

  if (coupon.maximumDiscount !== null) {
    discountCents = Math.min(discountCents, toCents(coupon.maximumDiscount));
  }
  discountCents = Math.min(discountCents, payableCents);

  if (discountCents <= 0) {
    return reject('COUPON_NOT_APPLICABLE', 'This coupon does not apply to your order');
  }
  return { ok: true, discountCents };
}
