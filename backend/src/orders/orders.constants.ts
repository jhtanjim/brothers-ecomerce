export const ORDER_NUMBER_PREFIX = 'ORD';
/** No 0/O/1/I so order numbers are easy to read out over the phone. */
export const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ORDER_NUMBER_SUFFIX_LENGTH = 6;
/** Retries when a random order number collides with an existing one. */
export const ORDER_NUMBER_MAX_ATTEMPTS = 3;
export const TRANSACTION_TIMEOUT_MS = 15_000;
export const TRANSACTION_MAX_WAIT_MS = 5_000;
