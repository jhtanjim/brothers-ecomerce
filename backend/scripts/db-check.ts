/**
 * Verifies that the local PostgreSQL server is reachable with the credentials in .env.
 * Usage: npm run db:check   (from the repo root, or inside /backend)
 * The password is never printed.
 */
import { existsSync } from 'node:fs';
import { Client } from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');

function fail(message: string, hints: string[] = []): never {
  console.error(`\n✖ ${message}`);
  for (const hint of hints) console.error(`   • ${hint}`);
  console.error('');
  process.exit(1);
}

function diagnose(error: unknown): never {
  const e = error as { code?: string; message?: string };
  switch (e.code) {
    case 'ECONNREFUSED':
      return fail('Connection refused: nothing is listening on that host/port.', [
        'Is the PostgreSQL service running? (Windows: Services → postgresql-x64-NN → Start)',
        'Check the port in pgAdmin: Server → Properties → Connection (default 5432).',
      ]);
    case 'ENOTFOUND':
      return fail('Host not found.', ['Use "localhost" as the host for a local installation.']);
    case '28P01':
      return fail('Authentication failed: wrong password for this user.', [
        'Check USERNAME/PASSWORD in DATABASE_URL.',
        'Special characters in the password must be URL-encoded (@ -> %40, : -> %3A, / -> %2F, # -> %23, % -> %25).',
      ]);
    case '28000':
      return fail('This PostgreSQL role does not exist or is not allowed to log in.', [
        'Create it in pgAdmin (see README, step "Create role") and check USERNAME in DATABASE_URL.',
      ]);
    case '3D000':
      return fail('The database does not exist.', [
        'Create it in pgAdmin (see README) and check DATABASE_NAME in DATABASE_URL.',
      ]);
    default:
      if (e.message?.toLowerCase().includes('timeout')) {
        return fail('Connection timed out.', [
          'Check that PostgreSQL is running and that host/port are correct.',
        ]);
      }
      return fail(`Unexpected connection error${e.code ? ` (${e.code})` : ''}: ${e.message}`);
  }
}

interface CheckRow {
  version: string;
  current_user: string;
  current_database: string;
  version_num: number;
  can_create_db: boolean;
  has_trgm: boolean;
}

async function main(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    fail('DATABASE_URL is not set.', ['Copy .env.example to .env and fill in your values.']);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail('DATABASE_URL is not a valid URL.', [
      'Expected: postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME?schema=public',
      'Special characters in the password must be URL-encoded (@ -> %40).',
    ]);
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    fail('DATABASE_URL must start with postgresql://');
  }

  const target = `${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`;
  console.log(`Connecting to ${target} as "${decodeURIComponent(url.username)}" ...`);

  // pg does not understand Prisma's ?schema= parameter
  url.searchParams.delete('schema');
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });

  try {
    await client.connect();
  } catch (error) {
    diagnose(error);
  }

  try {
    const { rows } = await client.query<CheckRow>(`
      SELECT
        version() AS version,
        current_user,
        current_database(),
        current_setting('server_version_num')::int AS version_num,
        COALESCE((SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user), false) AS can_create_db,
        EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') AS has_trgm
    `);
    const row = rows[0];

    console.log(`\n✔ PostgreSQL is reachable`);
    console.log(`  Server:   ${row.version.split(',')[0]}`);
    console.log(`  Database: ${row.current_database}`);
    console.log(`  Role:     ${row.current_user}`);

    const warnings: string[] = [];
    if (!row.can_create_db) {
      warnings.push(
        `Role "${row.current_user}" lacks CREATEDB: "prisma migrate dev" needs it for its shadow database. Fix in pgAdmin: ALTER ROLE ${row.current_user} CREATEDB;`,
      );
    }
    if (!row.has_trgm) {
      warnings.push(
        'Extension pg_trgm is not available on this server (needed from Phase 2 for fast search).',
      );
    }
    if (row.version_num < 130000) {
      warnings.push(
        'PostgreSQL 12 or older detected: pg_trgm is not a "trusted" extension there. Tell me your version before Phase 2.',
      );
    }

    const testUrl = process.env.DATABASE_URL_TEST;
    if (testUrl) {
      const testDb = testUrl.split('?')[0].split('/').pop() ?? '';
      if (!testDb.endsWith('_test')) {
        warnings.push('DATABASE_URL_TEST database name should end with "_test".');
      }
      if (testUrl === raw) {
        warnings.push('DATABASE_URL_TEST must differ from DATABASE_URL.');
      }
    }

    for (const w of warnings) console.warn(`  ⚠ ${w}`);
    console.log('');
  } finally {
    await client.end();
  }
}

main().catch((error) => diagnose(error));
