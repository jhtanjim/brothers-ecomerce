# Session state

Updated: **2026-10-30** — multi-tenant phase 1 written and tested; dev DB migration awaiting owner approval.

## Current status

- Git: branch `main`, no remote. Sprint committed 2026-10-29 as 6 focused commits (`3e6037b`..`3ee1eeb`:
  auth fix, setup checks, API, storefront, admin pages, docs). Working tree clean except the untracked
  `.claude/launch.json` (kept out of commits).
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

Multi-tenant plan: D37. Phase 1 (`backend/prisma/migrations/20261030090000_add_stores_phase1`, schema) is written,
applied to the `_test` DB and tested on a dropped copy of dev, but **not applied to the dev DB and not committed**.

**The regenerated Prisma client expects `storeId`, so the dev API can fail until the dev DB is migrated.** With owner
approval: `npm run db:deploy`, verify counts, commit. Then phase 2: required `storeId`, per-store uniques (user email
and phone, category name and slug, product slug and SKU, coupon code, settings key, transaction ID), store context on
every request, isolation tests. Pharmacy needs: Q12.

## Inspect first next time

- `CLAUDE.md`, this file, `docs/LAUNCH-CHECKLIST.md`, latest `docs/WORKLOG.md` entry.
- `git log --oneline -8` for the sprint commits.
