import { describe, expect, it } from 'vitest';
import { phoneVariants } from './phone-variants';

describe('phoneVariants', () => {
  const all = ['01712345678', '8801712345678', '+8801712345678'];

  it('finds a Bangladesh number however it was written', () => {
    expect(phoneVariants('01712345678')).toEqual(all);
    expect(phoneVariants('8801712345678')).toEqual(all);
    expect(phoneVariants('+8801712345678')).toEqual(all);
  });

  it('leaves any other number as it is', () => {
    expect(phoneVariants('1234567')).toEqual(['1234567']);
    expect(phoneVariants('+14155550100')).toEqual(['+14155550100']);
  });
});
