import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ACTIVITY_ACTIONS, ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SETTING_KEYS } from './settings.constants';
import { SettingsService } from './settings.service';

/** DTO field -> settings row key. */
const FIELD_KEYS = {
  deliveryHomeCity: SETTING_KEYS.deliveryHomeCity,
  deliveryHomeCityCharge: SETTING_KEYS.deliveryHomeCityCharge,
  deliveryOtherCityCharge: SETTING_KEYS.deliveryOtherCityCharge,
  deliveryFreeThreshold: SETTING_KEYS.deliveryFreeThreshold,
  bkashNumber: SETTING_KEYS.bkashNumber,
  nagadNumber: SETTING_KEYS.nagadNumber,
  screenshotEnabled: SETTING_KEYS.screenshotEnabled,
  maxPaymentAttempts: SETTING_KEYS.maxPaymentAttempts,
  unpaidExpiryHours: SETTING_KEYS.unpaidExpiryHours,
} as const satisfies Record<keyof UpdateSettingsDto, string>;

type Field = keyof typeof FIELD_KEYS;

export interface AdminSettingsView {
  deliveryHomeCity: string;
  deliveryHomeCityCharge: number;
  deliveryOtherCityCharge: number;
  deliveryFreeThreshold: number | null;
  /** The stored text, even when it is not a usable number (for example a placeholder). */
  bkashNumber: string | null;
  /** True when customers are shown this number; false means bKash shows "not set up". */
  bkashNumberValid: boolean;
  nagadNumber: string | null;
  nagadNumberValid: boolean;
  screenshotEnabled: boolean;
  maxPaymentAttempts: number;
  unpaidExpiryHours: number;
}

function storedText(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Admin view and editing of the business settings. Values shown are the EFFECTIVE ones (code
 * defaults fill in missing rows), so the page always matches what customers get.
 */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  async get(): Promise<AdminSettingsView> {
    const [delivery, payment, unpaidExpiryHours, merchantRows] = await Promise.all([
      this.settings.getDeliveryConfig(),
      this.settings.getPaymentConfig(),
      this.settings.getUnpaidExpiryHours(),
      this.prisma.setting.findMany({
        where: { key: { in: [SETTING_KEYS.bkashNumber, SETTING_KEYS.nagadNumber] } },
        select: { key: true, value: true },
      }),
    ]);
    const raw = new Map(merchantRows.map((row) => [row.key, row.value]));

    return {
      deliveryHomeCity: delivery.homeCity,
      deliveryHomeCityCharge: delivery.homeCityCharge,
      deliveryOtherCityCharge: delivery.otherCityCharge,
      deliveryFreeThreshold: delivery.freeThreshold,
      bkashNumber: storedText(raw.get(SETTING_KEYS.bkashNumber)),
      bkashNumberValid: payment.bkashNumber !== null,
      nagadNumber: storedText(raw.get(SETTING_KEYS.nagadNumber)),
      nagadNumberValid: payment.nagadNumber !== null,
      screenshotEnabled: payment.screenshotEnabled,
      maxPaymentAttempts: payment.maxAttempts,
      unpaidExpiryHours,
    };
  }

  /** Saves only the sent fields, in one transaction with an audit log entry of what changed. */
  async update(
    adminId: string,
    dto: UpdateSettingsDto,
    ipAddress: string | null,
  ): Promise<AdminSettingsView> {
    const before = await this.get();
    const fields = (Object.keys(FIELD_KEYS) as Field[]).filter((field) => dto[field] !== undefined);
    if (fields.length === 0) {
      throw new BadRequestException({ message: 'Nothing to update', code: 'NO_CHANGES' });
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of fields) {
      const to = dto[field] ?? null;
      if (before[field] !== to) changes[field] = { from: before[field], to };
    }
    if (Object.keys(changes).length === 0) return before;

    await this.prisma.$transaction(async (tx) => {
      for (const field of Object.keys(changes) as Field[]) {
        const key = FIELD_KEYS[field];
        // JSON null is a valid stored value (cleared threshold / merchant number).
        const value = (dto[field] ?? Prisma.JsonNull) as
          Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
        await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      }
      await this.activityLogs.record(tx, {
        adminId,
        action: ACTIVITY_ACTIONS.settingsUpdated,
        entityType: 'Setting',
        ipAddress,
        metadata: changes as Prisma.InputJsonValue,
      });
    });

    return this.get();
  }
}
