import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_DEFAULTS, SETTING_KEYS } from './settings.constants';

export interface DeliveryConfig {
  /** Orders shipped to this city (case-insensitive) pay homeCityCharge. */
  homeCity: string;
  homeCityCharge: number;
  otherCityCharge: number;
  /** Orders at or above this amount (after discounts) ship free; null means never free. */
  freeThreshold: number | null;
}

export interface PaymentConfig {
  /** null when the merchant number is missing or still a placeholder: payment is not set up. */
  bkashNumber: string | null;
  nagadNumber: string | null;
  screenshotEnabled: boolean;
  /** How many times a customer may submit a transaction for one order. */
  maxAttempts: number;
}

const MERCHANT_NUMBER_PATTERN = /^\+?[0-9]{7,15}$/;

function asNonNegativeNumber(value: Prisma.JsonValue | undefined): number | null {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function asPositiveInteger(value: Prisma.JsonValue | undefined): number | null {
  const parsed = asNonNegativeNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function asNonEmptyString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asBoolean(value: Prisma.JsonValue | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** A real phone-style number, or null (so a placeholder such as 01XXXXXXXXX is never shown). */
function asMerchantNumber(value: Prisma.JsonValue | undefined): string | null {
  const text = asNonEmptyString(value);
  if (text === null) return null;
  const compact = text.replace(/[\s-]/g, '');
  return MERCHANT_NUMBER_PATTERN.test(compact) ? compact : null;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async readMany(keys: string[]): Promise<Map<string, Prisma.JsonValue>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  async getDeliveryConfig(): Promise<DeliveryConfig> {
    const values = await this.readMany([
      SETTING_KEYS.deliveryHomeCity,
      SETTING_KEYS.deliveryHomeCityCharge,
      SETTING_KEYS.deliveryOtherCityCharge,
      SETTING_KEYS.deliveryFreeThreshold,
    ]);

    return {
      homeCity:
        asNonEmptyString(values.get(SETTING_KEYS.deliveryHomeCity)) ??
        SETTING_DEFAULTS.deliveryHomeCity,
      homeCityCharge:
        asNonNegativeNumber(values.get(SETTING_KEYS.deliveryHomeCityCharge)) ??
        SETTING_DEFAULTS.deliveryHomeCityCharge,
      otherCityCharge:
        asNonNegativeNumber(values.get(SETTING_KEYS.deliveryOtherCityCharge)) ??
        SETTING_DEFAULTS.deliveryOtherCityCharge,
      freeThreshold: asNonNegativeNumber(values.get(SETTING_KEYS.deliveryFreeThreshold)),
    };
  }

  /** How long an unpaid order holds its reserved stock. Always a positive number of hours. */
  async getUnpaidExpiryHours(): Promise<number> {
    const values = await this.readMany([SETTING_KEYS.unpaidExpiryHours]);
    const hours = asNonNegativeNumber(values.get(SETTING_KEYS.unpaidExpiryHours));
    return hours !== null && hours > 0 ? hours : SETTING_DEFAULTS.unpaidExpiryHours;
  }

  async getPaymentConfig(): Promise<PaymentConfig> {
    const values = await this.readMany([
      SETTING_KEYS.bkashNumber,
      SETTING_KEYS.nagadNumber,
      SETTING_KEYS.screenshotEnabled,
      SETTING_KEYS.maxPaymentAttempts,
    ]);

    return {
      bkashNumber: asMerchantNumber(values.get(SETTING_KEYS.bkashNumber)),
      nagadNumber: asMerchantNumber(values.get(SETTING_KEYS.nagadNumber)),
      screenshotEnabled:
        asBoolean(values.get(SETTING_KEYS.screenshotEnabled)) ?? SETTING_DEFAULTS.screenshotEnabled,
      maxAttempts:
        asPositiveInteger(values.get(SETTING_KEYS.maxPaymentAttempts)) ??
        SETTING_DEFAULTS.maxPaymentAttempts,
    };
  }
}
