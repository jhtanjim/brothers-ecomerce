import { apiFetch } from './client';
import type { ValidateCouponResult } from './types';

/** Preview only: the backend checks the coupon again, under a lock, when the order is placed. */
export function validateCoupon(couponCode: string): Promise<ValidateCouponResult> {
  return apiFetch<ValidateCouponResult>('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ couponCode }),
  });
}
