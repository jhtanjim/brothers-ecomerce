export const MEMBER_DISCOUNT_PERCENT = 5;

/** Taken on what the customer would otherwise pay, rounded down so it never exceeds the percent. */
export function memberDiscountCents(payableCents: number): number {
  return Math.floor((Math.max(0, payableCents) * MEMBER_DISCOUNT_PERCENT) / 100);
}
