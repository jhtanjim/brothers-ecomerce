/** Keys of the business settings rows (seeded by prisma/seed.ts). */
export const SETTING_KEYS = {
  deliveryHomeCity: 'delivery.homeCity',
  deliveryHomeCityCharge: 'delivery.homeCityCharge',
  deliveryOtherCityCharge: 'delivery.otherCityCharge',
  deliveryFreeThreshold: 'delivery.freeThreshold',
  unpaidExpiryHours: 'order.unpaidExpiryHours',
  bkashNumber: 'payment.bkashNumber',
  nagadNumber: 'payment.nagadNumber',
  screenshotEnabled: 'payment.screenshotEnabled',
  maxPaymentAttempts: 'payment.maxAttempts',
} as const;

/** Used only when a settings row is missing or invalid. Same values as the seed. */
export const SETTING_DEFAULTS = {
  deliveryHomeCity: 'Dhaka',
  deliveryHomeCityCharge: 60,
  deliveryOtherCityCharge: 120,
  unpaidExpiryHours: 24,
  screenshotEnabled: true,
  maxPaymentAttempts: 3,
} as const;
