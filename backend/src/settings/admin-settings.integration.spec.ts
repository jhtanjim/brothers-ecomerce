import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SETTING_DEFAULTS, SETTING_KEYS } from './settings.constants';
import { SettingsService } from './settings.service';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateSettingsDto, body);
  return (await validate(dto)).map((error) => error.property);
}

describe('admin settings (integration)', () => {
  let prisma: PrismaClient;
  let settings: SettingsService;
  let admin: AdminSettingsService;
  let adminId: string;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    const service = prisma as unknown as PrismaService;
    settings = new SettingsService(service);
    admin = new AdminSettingsService(service, settings, new ActivityLogsService());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        name: 'Admin',
        email: `admin-${randomUUID()}@example.com`,
        passwordHash: 'x',
        role: 'ADMIN',
      },
    });
    adminId = user.id;
  });

  it('shows the effective defaults when nothing is stored', async () => {
    expect(await admin.get()).toEqual({
      deliveryHomeCity: SETTING_DEFAULTS.deliveryHomeCity,
      deliveryHomeCityCharge: SETTING_DEFAULTS.deliveryHomeCityCharge,
      deliveryOtherCityCharge: SETTING_DEFAULTS.deliveryOtherCityCharge,
      deliveryFreeThreshold: null,
      bkashNumber: null,
      bkashNumberValid: false,
      nagadNumber: null,
      nagadNumberValid: false,
      screenshotEnabled: SETTING_DEFAULTS.screenshotEnabled,
      maxPaymentAttempts: SETTING_DEFAULTS.maxPaymentAttempts,
      unpaidExpiryHours: SETTING_DEFAULTS.unpaidExpiryHours,
    });
  });

  it('shows a stored placeholder merchant number as not valid', async () => {
    await prisma.setting.create({ data: { key: SETTING_KEYS.bkashNumber, value: '01XXXXXXXXX' } });
    const view = await admin.get();
    expect(view.bkashNumber).toBe('01XXXXXXXXX');
    expect(view.bkashNumberValid).toBe(false);
  });

  it('updates only the sent fields, takes effect immediately and logs the change', async () => {
    const view = await admin.update(
      adminId,
      { deliveryHomeCityCharge: 70, bkashNumber: '01711111111', deliveryFreeThreshold: 3000 },
      '127.0.0.1',
    );
    expect(view).toMatchObject({
      deliveryHomeCityCharge: 70,
      deliveryOtherCityCharge: SETTING_DEFAULTS.deliveryOtherCityCharge,
      deliveryFreeThreshold: 3000,
      bkashNumber: '01711111111',
      bkashNumberValid: true,
    });
    // The checkout/order code reads the same rows.
    expect((await settings.getDeliveryConfig()).homeCityCharge).toBe(70);
    expect((await settings.getPaymentConfig()).bkashNumber).toBe('01711111111');

    const logs = await prisma.activityLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'SETTINGS_UPDATED', adminId, ipAddress: '127.0.0.1' });
    expect(logs[0].metadata).toMatchObject({
      deliveryHomeCityCharge: { from: SETTING_DEFAULTS.deliveryHomeCityCharge, to: 70 },
      bkashNumber: { from: null, to: '01711111111' },
    });
  });

  it('null clears the free-delivery threshold and a merchant number', async () => {
    await admin.update(adminId, { deliveryFreeThreshold: 3000, nagadNumber: '01811111111' }, null);
    const view = await admin.update(
      adminId,
      { deliveryFreeThreshold: null, nagadNumber: null },
      null,
    );
    expect(view.deliveryFreeThreshold).toBeNull();
    expect(view.nagadNumber).toBeNull();
    expect(view.nagadNumberValid).toBe(false);
    expect((await settings.getPaymentConfig()).nagadNumber).toBeNull();
  });

  it('saving the same values changes nothing and writes no log', async () => {
    const current = await admin.get();
    await admin.update(adminId, { maxPaymentAttempts: current.maxPaymentAttempts }, null);
    expect(await prisma.activityLog.count()).toBe(0);
    await expect(admin.update(adminId, {}, null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('the DTO rejects invalid values and accepts typed phone numbers with spaces', async () => {
    expect(await errorsFor({ deliveryHomeCityCharge: -1 })).toEqual(['deliveryHomeCityCharge']);
    expect(await errorsFor({ deliveryOtherCityCharge: 10.555 })).toEqual([
      'deliveryOtherCityCharge',
    ]);
    expect(await errorsFor({ bkashNumber: '01XXXXXXXXX' })).toEqual(['bkashNumber']);
    expect(await errorsFor({ maxPaymentAttempts: 0 })).toEqual(['maxPaymentAttempts']);
    expect(await errorsFor({ unpaidExpiryHours: 200 })).toEqual(['unpaidExpiryHours']);
    expect(await errorsFor({ deliveryHomeCity: 'X' })).toEqual(['deliveryHomeCity']);
    expect(await errorsFor({ screenshotEnabled: 'yes' })).toEqual(['screenshotEnabled']);
    expect(await errorsFor({ deliveryHomeCityCharge: null })).toEqual(['deliveryHomeCityCharge']);
    expect(await errorsFor({ bkashNumber: '01711-111 111', deliveryFreeThreshold: null })).toEqual(
      [],
    );
    const dto = plainToInstance(UpdateSettingsDto, { bkashNumber: '01711-111 111' });
    expect(dto.bkashNumber).toBe('01711111111');
  });
});
