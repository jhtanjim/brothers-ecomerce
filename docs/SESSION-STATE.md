# Session state

Updated: **2026-10-30** — BROTHERS storefront design on branch `feat/brothers-fashion-store`.

## Current status

- Git: remote `origin` = github.com/jhtanjim/brothers-ecomerce; `main` pushed at `8fa6094`. `.claude/launch.json` stays out of commits.
- Checks (2026-10-29): typecheck + lint both apps, `prettier --check .`, backend `npx vitest run` 15 files / 137
  tests, `npm run build` (no warnings), `npm run db:check` — all pass.
- Launch readiness: ready for local testing; NOT ready for staging/real customers — see `docs/LAUNCH-CHECKLIST.md`.

## Blockers / verification gaps

- P0 before real customers: email provider (Q7), deployment target + production DB (Q8), production secrets,
  HTTPS, admin password change. Owner business setup on /admin/settings (Q6, merchant numbers, store name).
- Not re-verified in the browser: coupons at checkout (tests only), payment screenshot upload, dashboard figures,
  order detail / payment panel at 375 px with a live order, unpaid auto-expiry in real time (tests only).
- Dev DB test data: suspended test customer + 2 cancelled orders (see WORKLOG).
- Dev servers: first `/auth/me` may fail while the API boots; the frontend now retries (no false sign-out).

## Exact next action

BROTHERS (D37, D38). Done: brand, storefront, men's sample catalog with stock photos, sizes/colours with their own stock,
subcategories, material, new/bestseller flags, filters and admin screens. Next: (1) owner supplies real products, photos,
policies, size guide, contact and social details, then replaces the sample catalog
Q7/Q8 still open.

`prisma migrate dev` fails on its shadow DB (pg_trgm missing). Generate with `prisma migrate diff --from-url` and apply with
`prisma migrate deploy`.

Multi-tenant phase 1 is parked in `git stash` ("multi-tenant phase 1"); it is not on this branch. The `_test` DB still
has its migration applied (nullable columns plus a `_prisma_migrations` row); harmless to tests, may show in status.

## Inspect first next time

- `CLAUDE.md`, this file, `docs/LAUNCH-CHECKLIST.md`, latest `docs/WORKLOG.md` entry.
- `git log --oneline -8` for the sprint commits.
