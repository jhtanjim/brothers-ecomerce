import * as fs from 'node:fs';

/** Integration tests must never touch the dev database: point Prisma at DATABASE_URL_TEST. */
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const match = env.match(/^DATABASE_URL_TEST="?([^"\r\n]+)"?/m);
if (match) process.env.DATABASE_URL = match[1];
