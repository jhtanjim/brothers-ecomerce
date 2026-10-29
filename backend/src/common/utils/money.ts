import { Prisma } from '@prisma/client';

export type MoneyInput = number | string | Prisma.Decimal;

/** Exact conversion to integer cents (no floating-point drift). */
export function toCents(value: MoneyInput): number {
  return new Prisma.Decimal(value).mul(100).round().toNumber();
}

/** Integer cents to a decimal string such as "1250.00", matching how the API returns money. */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
