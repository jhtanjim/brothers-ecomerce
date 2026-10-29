import { describe, expect, it } from 'vitest';
import { evaluateCoupon } from './coupon-calculator';
import type { CouponRule } from './coupon-calculator';

const NOW = new Date('2026-10-24T12:00:00Z');

function rule(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    type: 'PERCENTAGE',
    value: '10',
    minimumOrderAmount: null,
    maximumDiscount: null,
    usageLimit: null,
    usedCount: 0,
    perUserLimit: null,
    startsAt: null,
    expiresAt: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

function rejected(result: ReturnType<typeof evaluateCoupon>): string {
  if (result.ok) throw new Error('expected a rejection');
  return result.code;
}

describe('evaluateCoupon: discount amounts', () => {
  it('percentage: 10% of 2,990.00 is 299.00', () => {
    expect(evaluateCoupon(rule(), 299000, 0, NOW)).toEqual({ ok: true, discountCents: 29900 });
  });

  it('percentage is floored in cents', () => {
    // 10% of 0.99 = 0.099 -> 9.9 cents -> 9
    expect(evaluateCoupon(rule(), 99, 0, NOW)).toEqual({ ok: true, discountCents: 9 });
  });

  it('fixed: returns the fixed amount', () => {
    expect(evaluateCoupon(rule({ type: 'FIXED', value: '50.00' }), 100000, 0, NOW)).toEqual({
      ok: true,
      discountCents: 5000,
    });
  });

  it('maximum discount caps a percentage coupon', () => {
    const result = evaluateCoupon(rule({ value: '20', maximumDiscount: '100' }), 299000, 0, NOW);
    expect(result).toEqual({ ok: true, discountCents: 10000 });
  });

  it('a fixed discount larger than the payable amount is capped at the payable amount', () => {
    expect(evaluateCoupon(rule({ type: 'FIXED', value: '500' }), 20000, 0, NOW)).toEqual({
      ok: true,
      discountCents: 20000,
    });
  });

  it('100% discount equals the payable amount', () => {
    expect(evaluateCoupon(rule({ value: '100' }), 12345, 0, NOW)).toEqual({
      ok: true,
      discountCents: 12345,
    });
  });

  it('a discount that rounds to zero does not apply', () => {
    // 10% of 0.05 = 0.5 cent -> floor 0
    expect(rejected(evaluateCoupon(rule(), 5, 0, NOW))).toBe('COUPON_NOT_APPLICABLE');
  });

  it('a zero payable amount does not apply', () => {
    expect(rejected(evaluateCoupon(rule(), 0, 0, NOW))).toBe('COUPON_NOT_APPLICABLE');
  });
});

describe('evaluateCoupon: status and dates', () => {
  it('rejects an inactive coupon', () => {
    expect(rejected(evaluateCoupon(rule({ status: 'INACTIVE' }), 100000, 0, NOW))).toBe(
      'COUPON_INACTIVE',
    );
  });

  it('rejects a coupon that has not started', () => {
    const startsAt = new Date(NOW.getTime() + 1);
    expect(rejected(evaluateCoupon(rule({ startsAt }), 100000, 0, NOW))).toBe('COUPON_NOT_STARTED');
  });

  it('accepts a coupon that starts exactly now', () => {
    expect(evaluateCoupon(rule({ startsAt: new Date(NOW) }), 100000, 0, NOW).ok).toBe(true);
  });

  it('rejects a coupon that expires exactly now', () => {
    expect(rejected(evaluateCoupon(rule({ expiresAt: new Date(NOW) }), 100000, 0, NOW))).toBe(
      'COUPON_EXPIRED',
    );
  });

  it('accepts a coupon that expires one millisecond from now', () => {
    const expiresAt = new Date(NOW.getTime() + 1);
    expect(evaluateCoupon(rule({ expiresAt }), 100000, 0, NOW).ok).toBe(true);
  });
});

describe('evaluateCoupon: limits', () => {
  it('rejects when the total usage limit is reached', () => {
    expect(rejected(evaluateCoupon(rule({ usageLimit: 5, usedCount: 5 }), 100000, 0, NOW))).toBe(
      'COUPON_USAGE_LIMIT_REACHED',
    );
  });

  it('accepts when one use remains', () => {
    expect(evaluateCoupon(rule({ usageLimit: 5, usedCount: 4 }), 100000, 0, NOW).ok).toBe(true);
  });

  it('rejects when the customer reached the per-customer limit', () => {
    expect(rejected(evaluateCoupon(rule({ perUserLimit: 1 }), 100000, 1, NOW))).toBe(
      'COUPON_USER_LIMIT_REACHED',
    );
  });

  it('accepts when the customer is below the per-customer limit', () => {
    expect(evaluateCoupon(rule({ perUserLimit: 2 }), 100000, 1, NOW).ok).toBe(true);
  });

  it('rejects when the minimum order amount is not met', () => {
    expect(rejected(evaluateCoupon(rule({ minimumOrderAmount: '1000' }), 99999, 0, NOW))).toBe(
      'COUPON_MINIMUM_NOT_MET',
    );
  });

  it('accepts when the payable amount equals the minimum exactly', () => {
    expect(evaluateCoupon(rule({ minimumOrderAmount: '1000' }), 100000, 0, NOW).ok).toBe(true);
  });

  it('the minimum message shows the amount with two decimals', () => {
    const result = evaluateCoupon(rule({ minimumOrderAmount: '1000' }), 100, 0, NOW);
    expect(!result.ok && result.message).toContain('1000.00');
  });
});

describe('evaluateCoupon: rule order', () => {
  it('inactive is reported before expired', () => {
    const result = evaluateCoupon(
      rule({ status: 'INACTIVE', expiresAt: new Date(0) }),
      100000,
      0,
      NOW,
    );
    expect(rejected(result)).toBe('COUPON_INACTIVE');
  });

  it('expired is reported before the usage limit', () => {
    const result = evaluateCoupon(
      rule({ expiresAt: new Date(0), usageLimit: 1, usedCount: 1 }),
      100000,
      0,
      NOW,
    );
    expect(rejected(result)).toBe('COUPON_EXPIRED');
  });
});
