import { BadRequestException } from '@nestjs/common';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** The client sends one fresh key (e.g. a UUID) per checkout attempt; retries reuse it. */
export function parseIdempotencyKey(value: string | undefined): string {
  if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new BadRequestException({
      message: 'A valid Idempotency-Key header is required',
      code: 'IDEMPOTENCY_KEY_INVALID',
    });
  }
  return value;
}
