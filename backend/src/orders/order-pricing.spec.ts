import { describe, expect, it } from 'vitest';
import { calculateDeliveryCents, calculateOrderPricing } from './order-pricing';
import type { PricingLineInput } from './order-pricing';
import type { DeliveryConfig } from '../settings/settings.service';

const DELIVERY = {
  homeCity: 'Dhaka',
  homeCityCharge: '60',
  otherCityCharge: '120',
  freeThreshold: null,
} as unknown as DeliveryConfig;

function withThreshold(freeThreshold: string | null): DeliveryConfig {
  return { ...DELIVERY, freeThreshold } as unknown as DeliveryConfig;
}

function line(overrides: Partial<PricingLineInput> = {}): PricingLineInput {
  return { productId: 'p1', regularPrice: '3500', paidPrice: '2990', quantity: 1, ...overrides };
}

describe('calculateOrderPricing: totals', () => {
  it('computes subtotal, product discount and total for one line', () => {
    const result = calculateOrderPricing([line()], 'Dhaka', DELIVERY);
    expect(result.subtotalCents).toBe(350000);
    expect(result.discountCents).toBe(51000);
    expect(result.couponDiscountCents).toBe(0);
    expect(result.deliveryCents).toBe(6000);
    expect(result.totalCents).toBe(299000 + 6000);
  });

  it('multiplies by quantity', () => {
    const result = calculateOrderPricing([line({ quantity: 3 })], 'Dhaka', DELIVERY);
    expect(result.subtotalCents).toBe(1050000);
    expect(result.discountCents).toBe(153000);
    expect(result.lines[0]).toMatchObject({
      unitPriceCents: 350000,
      discountCents: 153000,
      totalCents: 897000,
    });
  });

  it('sums several lines', () => {
    const result = calculateOrderPricing(
      [line(), line({ productId: 'p2', regularPrice: '100.50', paidPrice: '100.50', quantity: 2 })],
      'Dhaka',
      DELIVERY,
    );
    expect(result.subtotalCents).toBe(350000 + 20100);
    expect(result.discountCents).toBe(51000);
    expect(result.totalCents).toBe(299000 + 20100 + 6000);
  });

  it('total = subtotal - discounts - coupon + delivery', () => {
    const r = calculateOrderPricing([line({ quantity: 2 })], 'Chattogram', DELIVERY, 10000);
    expect(r.totalCents).toBe(
      r.subtotalCents - r.discountCents - r.couponDiscountCents + r.deliveryCents,
    );
  });

  it('a line with no discount has zero discount', () => {
    const result = calculateOrderPricing([line({ paidPrice: '3500' })], 'Dhaka', DELIVERY);
    expect(result.discountCents).toBe(0);
  });

  it('never charges more than the regular price (discount cannot be negative)', () => {
    const result = calculateOrderPricing(
      [line({ regularPrice: '100', paidPrice: '150' })],
      'Dhaka',
      DELIVERY,
    );
    expect(result.discountCents).toBe(0);
    expect(result.lines[0].totalCents).toBe(10000);
  });

  it('handles prices with cents exactly', () => {
    const result = calculateOrderPricing(
      [line({ regularPrice: '19.99', paidPrice: '19.99', quantity: 3 })],
      'Dhaka',
      DELIVERY,
    );
    expect(result.subtotalCents).toBe(5997);
  });
});

describe('calculateOrderPricing: coupon', () => {
  it('applies the coupon discount', () => {
    const result = calculateOrderPricing([line()], 'Dhaka', DELIVERY, 10000);
    expect(result.couponDiscountCents).toBe(10000);
    expect(result.totalCents).toBe(299000 - 10000 + 6000);
  });

  it('clamps the coupon to the amount after product discounts', () => {
    const result = calculateOrderPricing([line()], 'Dhaka', DELIVERY, 999999999);
    expect(result.couponDiscountCents).toBe(299000);
    expect(result.totalCents).toBe(6000);
  });

  it('treats a negative coupon as zero', () => {
    const result = calculateOrderPricing([line()], 'Dhaka', DELIVERY, -500);
    expect(result.couponDiscountCents).toBe(0);
  });
});

describe('calculateOrderPricing: invalid input', () => {
  it('throws on quantity 0', () => {
    expect(() => calculateOrderPricing([line({ quantity: 0 })], 'Dhaka', DELIVERY)).toThrow();
  });

  it('throws on a fractional quantity', () => {
    expect(() => calculateOrderPricing([line({ quantity: 1.5 })], 'Dhaka', DELIVERY)).toThrow();
  });
});

describe('calculateDeliveryCents', () => {
  it('home city charge', () => {
    expect(calculateDeliveryCents(100000, 'Dhaka', DELIVERY)).toBe(6000);
  });

  it('home city match ignores case and spaces', () => {
    expect(calculateDeliveryCents(100000, '  dHAKA ', DELIVERY)).toBe(6000);
  });

  it('other city charge', () => {
    expect(calculateDeliveryCents(100000, 'Chattogram', DELIVERY)).toBe(12000);
  });

  it('free when the payable amount reaches the threshold exactly', () => {
    expect(calculateDeliveryCents(500000, 'Dhaka', withThreshold('5000'))).toBe(0);
  });

  it('not free one cent below the threshold', () => {
    expect(calculateDeliveryCents(499999, 'Dhaka', withThreshold('5000'))).toBe(6000);
  });

  it('the threshold is checked after the coupon', () => {
    const delivery = withThreshold('2900');
    // Payable 2,990 reaches the 2,900 threshold: free delivery.
    expect(calculateOrderPricing([line()], 'Dhaka', delivery).deliveryCents).toBe(0);
    // A 100 coupon brings payable to 2,890, below the threshold: delivery is charged.
    expect(calculateOrderPricing([line()], 'Dhaka', delivery, 10000).deliveryCents).toBe(6000);
  });
});
