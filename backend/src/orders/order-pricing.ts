import { toCents } from '../common/utils/money';
import type { MoneyInput } from '../common/utils/money';
import type { DeliveryConfig } from '../settings/settings.service';

export interface PricingLineInput {
  productId: string;
  /** Regular price per unit (Product.price). */
  regularPrice: MoneyInput;
  /** Price actually charged per unit (discountPrice when set, otherwise price). */
  paidPrice: MoneyInput;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  quantity: number;
  /** Regular unit price at purchase (OrderItem.unitPrice). */
  unitPriceCents: number;
  /** Total product-level discount for this line (OrderItem.discountAmount). */
  discountCents: number;
  /** unitPrice x quantity - discount (OrderItem.totalPrice). */
  totalCents: number;
}

export interface OrderPricing {
  lines: PricedLine[];
  /** Sum of regular price x quantity. */
  subtotalCents: number;
  /** Sum of product-level discounts. */
  discountCents: number;
  couponDiscountCents: number;
  deliveryCents: number;
  totalCents: number;
}

/** Delivery charge for an order whose payable amount (after discounts) is known. */
export function calculateDeliveryCents(
  payableCents: number,
  shippingCity: string,
  delivery: DeliveryConfig,
): number {
  if (delivery.freeThreshold !== null && payableCents >= toCents(delivery.freeThreshold)) {
    return 0;
  }
  const isHomeCity = shippingCity.trim().toLowerCase() === delivery.homeCity.trim().toLowerCase();
  return toCents(isHomeCity ? delivery.homeCityCharge : delivery.otherCityCharge);
}

/**
 * Single source of truth for order totals. Works only in integer cents.
 * `couponDiscountCents` is always 0 until the coupon phase; it is clamped to the payable amount.
 */
export function calculateOrderPricing(
  inputs: PricingLineInput[],
  shippingCity: string,
  delivery: DeliveryConfig,
  couponDiscountCents = 0,
): OrderPricing {
  let subtotalCents = 0;
  let discountCents = 0;

  const lines = inputs.map((input): PricedLine => {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new Error(`Invalid quantity for product ${input.productId}`);
    }
    const unitPriceCents = toCents(input.regularPrice);
    // Never charge more than the regular price, so a discount can never be negative.
    const paidCents = Math.min(toCents(input.paidPrice), unitPriceCents);

    const lineDiscount = (unitPriceCents - paidCents) * input.quantity;
    const lineTotal = paidCents * input.quantity;

    subtotalCents += unitPriceCents * input.quantity;
    discountCents += lineDiscount;

    return {
      productId: input.productId,
      quantity: input.quantity,
      unitPriceCents,
      discountCents: lineDiscount,
      totalCents: lineTotal,
    };
  });

  const afterDiscount = subtotalCents - discountCents;
  const coupon = Math.min(Math.max(0, couponDiscountCents), afterDiscount);
  const payable = afterDiscount - coupon;
  const deliveryCents = calculateDeliveryCents(payable, shippingCity, delivery);

  return {
    lines,
    subtotalCents,
    discountCents,
    couponDiscountCents: coupon,
    deliveryCents,
    totalCents: payable + deliveryCents,
  };
}
