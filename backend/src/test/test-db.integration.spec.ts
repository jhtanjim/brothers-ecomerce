import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDatabase } from './db';

describe('test database', () => {
  let prisma: PrismaClient | undefined;

  beforeAll(async () => {
    prisma = await createTestPrisma();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('connects to a _test database and can be emptied', async () => {
    if (!prisma) throw new Error('no database connection');
    await resetDatabase(prisma);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
  });
});
