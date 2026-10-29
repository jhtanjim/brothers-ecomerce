# E-Commerce Platform

Next.js (storefront + admin) · NestJS (REST API) · PostgreSQL · Prisma.
Modular monolith. **No Docker is required for local development.**

## Structure

```
ecommerce-platform/
├── backend/    NestJS API  → http://localhost:4000/api/v1
└── frontend/   Next.js app → http://localhost:3000
```

## Prerequisites

- Node.js 20.12+ (22 recommended)
- npm 10+ (bundled with Node.js)
- PostgreSQL installed locally + pgAdmin

## Local database setup (pgAdmin)

1. Open pgAdmin, connect to your server, then right-click database **postgres → Query Tool**.
2. Run (choose your own password; the names are suggestions):

   ```sql
   CREATE ROLE ecommerce_user WITH LOGIN PASSWORD 'CHOOSE_A_STRONG_PASSWORD' CREATEDB;
   CREATE DATABASE ecommerce_dev      OWNER ecommerce_user ENCODING 'UTF8';
   CREATE DATABASE ecommerce_dev_test OWNER ecommerce_user ENCODING 'UTF8';
   ```

   `CREATEDB` is required: `prisma migrate dev` creates a temporary shadow database.

3. Enable the trigram extension used for fast search from Phase 2. Right-click
   **ecommerce_dev → Query Tool**, run the line below, then repeat for **ecommerce_dev_test**:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

4. Find your port in pgAdmin: server **Properties → Connection** (default `5432`).

## Install and configure

```bash
npm install                       # from the repo root; installs backend + frontend (npm workspaces)
```

Backend env:

```bash
cd backend
cp .env.example .env              # PowerShell: Copy-Item .env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` (and `DATABASE_URL_TEST`):

```
DATABASE_URL="postgresql://ecommerce_user:YOUR_PASSWORD@localhost:5432/ecommerce_dev?schema=public"
```

If the password contains `@ : / ? # %`, URL-encode them (`@` → `%40`, `:` → `%3A`, `/` → `%2F`,
`#` → `%23`, `%` → `%25`).

Frontend env:

```bash
cd ../frontend
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
cd ..                             # back to the repo root
```

## Verify the database (Phase 1 checks)

Run from the **repo root**:

```bash
npm run db:check                       # 1. PostgreSQL reachable (plain-language diagnosis on failure)
npm run db:validate                    # 2a. schema + DATABASE_URL readable
npm run db:migrate -- --name init      # 2b/3. Prisma connects and a migration runs
npm run dev:backend                    # 4. NestJS boots and logs "Connected to PostgreSQL via Prisma"
```

Then, in another terminal:

```bash
curl http://localhost:4000/api/v1/health      # 5. database health check
```

Expected: `{"success":true,"data":{"status":"ok","database":"up",...},"message":"Success"}`
If PostgreSQL is stopped: HTTP 503 with `{"success":false,"code":"DATABASE_UNAVAILABLE",...}`.

## Run the project

```bash
# terminal 1
npm run dev:backend     # http://localhost:4000/api/v1
# terminal 2
npm run dev:frontend    # http://localhost:3000 (shows live API/DB status)
```

## Quality commands

```bash
npm run typecheck       # backend + frontend
npm run lint            # backend + frontend
npm run format          # Prettier (write)
npm run format:check    # Prettier (check only)
```

## Database commands (from the repo root)

| Command | Purpose |
| --- | --- |
| `npm run db:check` | Verify PostgreSQL connectivity |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate -- --name <name>` | Create + apply a dev migration (`prisma migrate dev`) |
| `npm run db:deploy` | Apply existing migrations (`prisma migrate deploy`) |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:studio` | Open Prisma Studio |

Run any other Prisma command with: `npx prisma <command>` inside `backend/`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `ECONNREFUSED` | PostgreSQL service not running, or wrong port |
| `password authentication failed` | Wrong password, or special characters not URL-encoded |
| `database "..." does not exist` | Create it in pgAdmin (step 2) |
| `permission denied to create database` on migrate | Role lacks `CREATEDB`: `ALTER ROLE ecommerce_user CREATEDB;` |
| `@prisma/client did not initialize yet` | Run `npm run db:generate` |
