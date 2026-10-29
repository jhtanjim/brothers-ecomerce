import { Transform } from 'class-transformer';

/**
 * For query strings: converts only the exact values "true"/"false" to booleans.
 * Anything else is left unchanged so @IsBoolean() rejects it with a 400.
 * (@Type(() => Boolean) is wrong here because Boolean("false") === true.)
 */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  });
}