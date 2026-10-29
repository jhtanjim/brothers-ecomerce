# Project status

Source of truth for current project state. Last verified against code: **2026-10-29** (initial audit).

## Goal

Online store for a Bangladesh merchant: customers browse, add to a server-side cart, check out, and pay
manually via bKash/Nagad (submit transaction ID + optional screenshot); admins review payments, fulfil
orders, and manage coupons. No formal requirements document exists; "Planned" items come from code comments.

## Status labels

- **Implemented** — code is complete for the feature. Verification is tracked separately.
- **Partial** — some layers exist (usually backend API without UI).
- **Missing** — not present; needed for a usable store.
- **Planned** — only mentioned in code comments; needs owner confirmation.
- **Unverified** — not exercised at runtime (no server run, no E2E, integration specs not run).

## Architecture

- npm workspaces: `backend/` (NestJS 11, Prisma 6.19, PostgreSQL, argon2, @nestjs/jwt, throttler, helmet,
  multer, Cloudinary SDK) and `frontend/` (Next.js 15 App Router, React 19, Tailwind 3). Tests: Vitest (backend only).
- Browser → Next.js `/api/v1/*` rewrite → NestJS → Prisma → PostgreSQL. Server components call NestJS
  directly with short revalidation for catalog data.
- Global guards in `backend/src/app.module.ts`: Throttler (in-memory) → JwtAuthGuard (cookie `access_token`)
  → RolesGuard. Global response interceptor + exception filter define the API envelope.
- Business settings (delivery charges, merchant numbers, payment attempts, unpaid expiry) live in the
  `settings` table (`backend/src/settings/`), seeded by `prisma/seed.ts`, with code defaults as fallback.
- Cloudinary: public product images; private (`authenticated`) payment screenshots served via signed URLs.
- Email: `common/mailer/mailer.service.ts` is a stub that logs the reset link.
- Unpaid-order expiry: in-process `setInterval` job (`orders/order-expiry.service.ts`), every 5 min.
- Roles: `CUSTOMER`, `ADMIN`. Guests can browse only; cart/checkout require login.

## Features

| Feature                                                                       | Status                  | Notes / evidence                                                               |
| ----------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Auth: register, login, logout, refresh rotation + reuse detection, `/auth/me` | Implemented, Unverified | `backend/src/auth/`, `frontend/components/auth/`, `lib/api/client.ts`          |
| Forgot / reset password                                                       | Partial                 | API exists; email is a log stub; no frontend pages                             |
| Public catalog: list, search (pg_trgm), filter, sort, detail, categories      | Implemented, Unverified | `products/`, `categories/`, `frontend/app/(store)/products`                    |
| Admin product CRUD + images (upload/primary/reorder/delete)                   | Partial                 | API `admin/products/*`; no admin UI                                            |
| Admin category CRUD                                                           | Partial                 | API `admin/categories/*`; no admin UI                                          |
| Cart (server-side, logged-in only)                                            | Implemented, Unverified | `cart/`; limits 20/line, 50 lines                                              |
| Addresses                                                                     | Partial                 | Full API; frontend uses list/create inside checkout only; no address book page |
| Checkout / order creation                                                     | Implemented, Unverified | `orders/orders.service.ts`; pricing unit-tested                                |
| Unpaid-order auto-expiry                                                      | Implemented, Unverified | `orders/order-expiry.service.ts`                                               |
| Customer orders: list, detail, cancel                                         | Implemented, Unverified | `frontend/app/(store)/account/orders`                                          |
| Manual payment proof submission                                               | Implemented, Unverified | `payments/payments.service.ts`, `components/order/PaymentPanel.tsx`            |
| Admin payment review (approve/reject)                                         | Implemented, Unverified | `payments/admin-payments.service.ts`, `app/admin/payments`                     |
| Admin order status management                                                 | Implemented, Unverified | `orders/admin-orders.service.ts`; transitions unit-tested                      |
| Coupons: admin CRUD + customer validate                                       | Implemented, Unverified | `coupons/`; calculator unit-tested                                             |
| Admin dashboard: overview, sales, top products                                | Implemented, Unverified | `dashboard/`, `app/admin/page.tsx`                                             |
| Business settings management                                                  | Partial                 | Read-only service; changes need DB edits (no API/UI)                           |
| Activity log                                                                  | Partial                 | Payments/orders/coupons only; not products/categories; no viewer               |
| Admin customer list / suspend                                                 | Missing                 | Schema supports `UserStatus.SUSPENDED`; no endpoint/UI                         |
| Refund tracking                                                               | Missing                 | Cancel of paid order returns `refundNeeded: true`; nothing records it          |
| Order / payment emails                                                        | Missing                 | —                                                                              |
| Customer profile page                                                         | Missing                 | —                                                                              |
| Payment gateway (SSLCommerz/Stripe)                                           | Planned                 | Comment on `PaymentProvider` enum in `schema.prisma`                           |
| Real email provider (Resend/SMTP)                                             | Planned                 | Comment in `mailer.service.ts`                                                 |
| SEO: sitemap, robots                                                          | Implemented, Unverified | `frontend/app/sitemap.ts`, `robots.ts`                                         |
| Health check                                                                  | Implemented, Unverified | `GET /api/v1/health`                                                           |

## Known issues and technical debt

1. Resolved 2026-10-29: Git on `main` (no remote); `.gitattributes` forces LF despite global `core.autocrlf=true`.
2. Resolved 2026-10-29: temporary `tmp-coupon-cancel.ts` deleted (was the only lint error).
3. Resolved 2026-10-29: whole repo Prettier-formatted; keep it that way.
4. `pg_trgm` extension is not created by any migration; a fresh `migrate deploy` needs the manual README step first.
5. `SHADOW_DATABASE_URL` placeholder added to `backend/.env.example` (2026-10-29). README setup still doesn't tell
   new developers to create the shadow database.
6. `backend/prisma/phase2-migration-extras.sql` duplicates migration `20260928120000_add_integrity_constraints`.
7. `BKASH_NUMBER`/`NAGAD_NUMBER` env vars are read only by the seed, which never overwrites existing rows.
8. Local `DATABASE_URL` connects as the `postgres` superuser, not a least-privilege role.
9. Reset-password link (raw token) is logged at info level with no production guard.
10. JwtAuthGuard trusts the token for up to 15 min: suspension/role change is not enforced until expiry.
11. Minor: login timing allows email enumeration; refresh rotation is not atomic under concurrency;
    expired refresh/reset tokens are never purged; rate-limit storage is per process.
12. Expiry job runs in every API instance if scaled horizontally (safe via row locks, wasteful).
13. No frontend tests, no E2E tests, no CI.
14. `.nvmrc` says Node 20; the dev machine runs Node 24 / npm 12.

## Baseline checks (2026-10-29)

| Check                                                                            | Result                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `npm run typecheck -w backend`                                                   | Pass                                                     |
| `npm run typecheck -w frontend`                                                  | Pass                                                     |
| `npm run lint -w frontend`                                                       | Pass                                                     |
| `npm run lint -w backend`                                                        | Pass (after cleanup, 2026-10-29)                         |
| `npx prettier --check .`                                                         | Pass (after cleanup, 2026-10-29)                         |
| Unit specs: coupon-calculator, order-pricing, order-transitions, image-signature | Pass — 4 files, 56 tests                                 |
| Full suite `npx vitest run` in `backend/` (unit + integration, `_test` DB)       | Pass — 10 files, 112 tests, ~38 s                        |
| `prisma validate` / `db:check` / `prisma migrate status`                         | Pass — schema valid, dev DB reachable, schema up to date |

Integration specs (run 2026-10-29, they TRUNCATE the `_test` DB) cover backend services for auth, orders,
order expiry, payments and admin coupons, plus the `_test`-DB guard. They do not cover HTTP-level/frontend behaviour.

**Not run:** `next build`, backend/frontend startup, any browser or end-to-end flow. "Unverified" therefore
means not exercised through the running app.

## Next recommended task

See `docs/SESSION-STATE.md` for the exact next action. Roadmap order:

0. ~~Baseline commit~~ — done (`ab7087f`).
1. ~~Hygiene~~ — done 2026-10-29 except `pg_trgm` handling (Q11) and the README shadow-DB note.
2. ~~Run integration specs~~ — done 2026-10-29, all pass.
3. Admin category UI, then admin product UI with images (largest feature gap).
4. Admin settings API + UI.
5. Password reset pages + real email provider; stop logging tokens in production.
6. Customer address book and profile.
7. Admin customer list / suspend (with per-request status check).
8. Order/payment emails; refund tracking.
9. Hardening: token cleanup, catalog activity logging, CI, prod DB role, deployment plan.
10. Payment gateway (later).
