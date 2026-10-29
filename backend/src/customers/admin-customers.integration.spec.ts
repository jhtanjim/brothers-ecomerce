import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrisma, resetDatabase } from '../test/db';
import { AdminCustomersService } from './admin-customers.service';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';

const query = (extra: Partial<AdminCustomerQueryDto> = {}) =>
  ({ page: 1, limit: 20, ...extra }) as AdminCustomerQueryDto;

describe('admin customers (integration)', () => {
  let prisma: PrismaClient;
  let service: AdminCustomersService;
  let adminId: string;

  const makeUser = (name: string, role: Role = Role.CUSTOMER, phone?: string) =>
    prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase()}-${randomUUID()}@example.com`,
        phone,
        passwordHash: 'x',
        role,
      },
    });

  beforeAll(async () => {
    prisma = await createTestPrisma();
    service = new AdminCustomersService(
      prisma as unknown as PrismaService,
      new ActivityLogsService(),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    adminId = (await makeUser('Admin', Role.ADMIN)).id;
  });

  it('lists customers only, newest first, with search and status filters', async () => {
    const rahim = await makeUser('Rahim', Role.CUSTOMER, '01711111111');
    await makeUser('Karim');
    await prisma.user.update({ where: { id: rahim.id }, data: { status: UserStatus.SUSPENDED } });

    const all = await service.list(query());
    expect(all.meta.total).toBe(2);
    expect(all.data.map((c) => c.name)).toEqual(['Karim', 'Rahim']);
    expect(all.data.every((c) => c.orderCount === 0 && c.lastOrderAt === null)).toBe(true);

    expect((await service.list(query({ search: 'rah' }))).data.map((c) => c.name)).toEqual([
      'Rahim',
    ]);
    expect((await service.list(query({ search: '0171111' }))).data.map((c) => c.name)).toEqual([
      'Rahim',
    ]);
    expect((await service.list(query({ status: UserStatus.SUSPENDED }))).meta.total).toBe(1);
  });

  it('suspending revokes every session and logs it; reactivating logs it too', async () => {
    const customer = await makeUser('Sumi');
    await prisma.refreshToken.createMany({
      data: [1, 2].map((n) => ({
        userId: customer.id,
        tokenHash: `hash-${n}-${randomUUID()}`,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    });

    const suspended = await service.setStatus(
      adminId,
      customer.id,
      { status: UserStatus.SUSPENDED, reason: 'Fraud check' },
      '10.0.0.1',
    );
    expect(suspended.status).toBe(UserStatus.SUSPENDED);
    expect(
      await prisma.refreshToken.count({ where: { userId: customer.id, revokedAt: null } }),
    ).toBe(0);

    await service.setStatus(adminId, customer.id, { status: UserStatus.ACTIVE }, null);
    const logs = await prisma.activityLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CUSTOMER_SUSPENDED', 'CUSTOMER_REACTIVATED']);
    expect(logs[0]).toMatchObject({ entityId: customer.id, ipAddress: '10.0.0.1' });
    expect(logs[0].metadata).toMatchObject({ reason: 'Fraud check' });
  });

  it('setting the same status again changes nothing and writes no log', async () => {
    const customer = await makeUser('Same');
    await service.setStatus(adminId, customer.id, { status: UserStatus.ACTIVE }, null);
    expect(await prisma.activityLog.count()).toBe(0);
  });

  it('never touches an admin account (reported as not found)', async () => {
    const otherAdmin = await makeUser('Boss', Role.ADMIN);
    for (const id of [otherAdmin.id, adminId, 'missing-id']) {
      await expect(
        service.setStatus(adminId, id, { status: UserStatus.SUSPENDED }, null),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN } });
    expect(admins.every((a) => a.status === UserStatus.ACTIVE)).toBe(true);
    expect((await service.list(query())).meta.total).toBe(0);
  });
});
