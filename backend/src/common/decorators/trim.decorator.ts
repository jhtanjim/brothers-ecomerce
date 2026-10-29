import { Transform } from 'class-transformer';

/** Trims surrounding whitespace on string inputs; leaves other types untouched. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));