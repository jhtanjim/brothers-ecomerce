import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { AdminCouponsService } from './admin-coupons.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

describe('admin coupons (integration)', () => {
  let prisma: PrismaClient;
  let service: AdminCouponsService;
  let adminId: string;

  const create = (data: Partial<CreateCouponDto> = {}) =>
    service.create(
      adminId,
      { code: 'SAVE10', type: 'PERCENTAGE', value: '10', ...data } as CreateCouponDto,
      null,
    );
  const update = (id: string, data: Partial<UpdateCouponDto>) =>
    service.update(adminId, id, data as UpdateCouponDto, null);
  const query = (data: Partial<CouponQueryDto> = {}) =>
    service.list({ page: 1, limit: 20, ...data } as CouponQueryDto);

  beforeAll(async () => {
    prisma = await createTestPrisma();
    service = new AdminCouponsService(
      prisma as unknown as PrismaService,
      new ActivityLogsService(),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminId = (
      await prisma.user.create({
        data: { name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'ADMIN' },
      })
    ).id;
  });

  it('creates a coupon and writes an activity log', async () => {
    const coupon = await create({ maximumDiscount: '200' });
    expect(coupon).toMatchObject({
      code: 'SAVE10',
      value: '10.00',
      maximumDiscount: '200.00',
      usedCount: 0,
      status: 'ACTIVE',
    });
    expect(
      await prisma.activityLog.count({ where: { action: 'COUPON_CREATED', entityId: coupon.id } }),
    ).toBe(1);
  });

  it('a duplicate code is refused', async () => {
    await create();
    await expect(create()).rejects.toMatchObject({ response: { code: 'COUPON_CODE_TAKEN' } });
    expect(await prisma.coupon.count()).toBe(1);
  });

  it('a percentage above 100 is refused', async () => {
    await expect(create({ value: '150' })).rejects.toMatchObject({
      response: { code: 'COUPON_INVALID' },
    });
  });

  it('a maximum discount on a FIXED coupon is refused', async () => {
    await expect(
      create({ type: 'FIXED', value: '5', maximumDiscount: '10' }),
    ).rejects.toMatchObject({
      response: { code: 'COUPON_INVALID' },
    });
  });

  it('an expiry before the start is refused', async () => {
    await expect(
      create({ startsAt: new Date('2030-01-02'), expiresAt: new Date('2030-01-01') }),
    ).rejects.toMatchObject({ response: { code: 'COUPON_INVALID' } });
  });

  it('update re-checks the merged rules (switching to FIXED with a cap set fails)', async () => {
    const coupon = await create({ maximumDiscount: '200' });
    await expect(update(coupon.id, { type: 'FIXED' })).rejects.toMatchObject({
      response: { code: 'COUPON_INVALID' },
    });
  });

  it('null clears an optional limit', async () => {
    const coupon = await create({ usageLimit: 5 });
    const updated = await update(coupon.id, { usageLimit: null });
    expect(updated.usageLimit).toBeNull();
  });

  it('an unused coupon can change its code and type', async () => {
    const coupon = await create();
    const updated = await update(coupon.id, { code: 'NEWCODE', type: 'FIXED', value: '5' });
    expect(updated).toMatchObject({ code: 'NEWCODE', type: 'FIXED' });
  });

  it('a used coupon cannot change code or type, but can change its value', async () => {
    const coupon = await create();
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: 1 } });

    await expect(update(coupon.id, { code: 'OTHER' })).rejects.toMatchObject({
      response: { code: 'COUPON_LOCKED' },
    });
    await expect(update(coupon.id, { type: 'FIXED' })).rejects.toMatchObject({
      response: { code: 'COUPON_LOCKED' },
    });
    expect((await update(coupon.id, { value: '7' })).value).toBe('7.00');
    // Sending the same code and type is not a change.
    expect((await update(coupon.id, { code: 'SAVE10', type: 'PERCENTAGE' })).code).toBe('SAVE10');
  });

  it('an unused coupon can be deleted, with a log', async () => {
    const coupon = await create();
    expect(await service.remove(adminId, coupon.id, null)).toEqual({
      id: coupon.id,
      deleted: true,
    });
    expect(await prisma.coupon.count()).toBe(0);
    expect(await prisma.activityLog.count({ where: { action: 'COUPON_DELETED' } })).toBe(1);
  });

  it('a used coupon cannot be deleted', async () => {
    const coupon = await create();
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: 1 } });
    await expect(service.remove(adminId, coupon.id, null)).rejects.toMatchObject({
      response: { code: 'COUPON_IN_USE' },
    });
    expect(await prisma.coupon.count()).toBe(1);
  });

  it('a missing coupon is reported as not found', async () => {
    await expect(service.findOne('nope')).rejects.toMatchObject({
      response: { code: 'COUPON_NOT_FOUND' },
    });
    await expect(service.remove(adminId, 'nope', null)).rejects.toMatchObject({
      response: { code: 'COUPON_NOT_FOUND' },
    });
  });

  it('changing the status writes a log', async () => {
    const coupon = await create();
    const updated = await service.setStatus(adminId, coupon.id, 'INACTIVE', null);
    expect(updated.status).toBe('INACTIVE');
    expect(await prisma.activityLog.count({ where: { action: 'COUPON_STATUS_CHANGED' } })).toBe(1);
  });

  it('the list filters by status and searches by code', async () => {
    await create({ code: 'ALPHA' });
    const beta = await create({ code: 'BETA' });
    await service.setStatus(adminId, beta.id, 'INACTIVE', null);

    expect((await query()).meta.total).toBe(2);
    expect((await query({ status: 'INACTIVE' })).data.map((c) => c.code)).toEqual(['BETA']);
    expect((await query({ search: 'alp' })).data.map((c) => c.code)).toEqual(['ALPHA']);
  });
});
