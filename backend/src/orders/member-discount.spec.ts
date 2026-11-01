import { describe, expect, it } from 'vitest';
import { memberDiscountCents } from './member-discount';

describe('memberDiscountCents', () => {
  it('takes 5 percent', () => {
    expect(memberDiscountCents(755_000)).toBe(37_750);
  });

  it('rounds down, so it never gives more than 5 percent', () => {
    expect(memberDiscountCents(19)).toBe(0);
    expect(memberDiscountCents(39)).toBe(1);
  });

  it('gives nothing when nothing is payable', () => {
    expect(memberDiscountCents(0)).toBe(0);
    expect(memberDiscountCents(-100)).toBe(0);
  });
});
