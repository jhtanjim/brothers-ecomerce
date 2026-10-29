import { PrismaClient } from '@prisma/client';

/** Connects to the test database. Refuses to run against anything whose name does not end in _test. */
export async function createTestPrisma(): Promise<PrismaClient> {
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = rows[0]?.name ?? '';
  if (!name.endsWith('_test')) {
    await prisma.$disconnect();
    throw new Error(`Refusing to run: connected to "${name}", which is not a _test database`);
  }
  return prisma;
}

/** Empties every table (keeps the migration history). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
