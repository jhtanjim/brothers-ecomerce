# Launch checklist

Status as of **2026-10-29** (end of the 3-day sprint). Tick items as they are done. Owner = the store owner;
Dev = developer. Never put secret values in this file.

## Blockers before real customers (P0)

- [ ] **Email provider (Q7, Owner + Dev).** Production cannot send password-reset emails (D30). Choose a provider
      (for example Resend or SMTP), then replace the body of `backend/src/common/mailer/mailer.service.ts`.
- [ ] **Deployment target and production database (Q8, Owner + Dev).** Decide hosting for the API, the Next.js app
      and PostgreSQL; run the first `npm run db:deploy` there after `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (README).
- [ ] **Production secrets (Dev).** New `JWT_SECRET` / `JWT_REFRESH_SECRET` (32+ chars, different), Cloudinary keys,
      `DATABASE_URL` for a least-privilege role (not `postgres`), `NODE_ENV=production`, `FRONTEND_URL`,
      `BACKEND_URL`, `NEXT_PUBLIC_SITE_URL` (https). `TRUST_PROXY` = number of proxies in front of the API.
- [ ] **HTTPS (Dev).** Cookies are `Secure` in production and HSTS is sent, so the site must be served over https.
- [ ] **Change the admin password (Owner).** The current one was shared in a chat during development.

## Business setup (Owner, on `/admin/settings`)

- [ ] Real delivery charges, home city and free-delivery threshold (Q6). Current 60 / 120 are placeholders.
- [ ] Confirm the bKash and Nagad merchant numbers. In the dev DB they are identical.
- [ ] Payment attempts per order and unpaid hold time (defaults 3 and 24 h).
- [ ] Store name and logo. The site still shows "E-Commerce Platform" (`SITE_NAME` in `frontend/lib/format.ts`).
- [ ] Real categories and products with photos (`/admin/categories`, `/admin/products`); remove or deactivate the
      seed sample products and categories.
- [ ] Decide guest checkout (Q5; today customers must create an account).

## Data clean-up before go-live (Dev, needs owner approval)

- [ ] Production DB starts empty except the admin (seed with `NODE_ENV=production` skips sample catalog).
- [ ] Dev-only test data stays in dev: test customer `claude.test.customer.*@example.com` (suspended) and cancelled
      orders ORD-20261029-YWQH3A / ORD-20261029-BFZG95.

## Build and deploy (Dev)

- [ ] `npm ci` at the repo root, then `npm run db:check` against the production DB.
- [ ] `npm run db:deploy`, then `npm run db:seed` (creates the admin and settings rows only in production).
- [ ] `npm run build` with `BACKEND_URL` reachable (otherwise pre-rendered pages start in their error state and
      recover within 60 s).
- [ ] Start: `node backend/dist/main` and `next start` (frontend) behind the proxy; check `GET /api/v1/health`.
- [ ] Run one real order end to end with a small real payment, then refund it manually.

## Already verified locally (2026-10-29)

- Checks: typecheck + lint (both apps), `prettier --check .`, backend `npx vitest run` (15 files, 137 tests),
  `npm run build` (no warnings), `npm run db:check`.
- Browser end to end: register, cart, checkout with delivery quote, order, bKash/Nagad submission, reject,
  resubmit, approve, status changes, admin cancel (refund notice), customer cancel, stock restored.
- Admin: products (incl. Cloudinary images), categories, customers (suspend), settings (review only), payments,
  orders. Coupons: integration tests only this sprint. Dashboard: loads, figures not re-checked this sprint.
- Mobile 375 px / accessibility pass on the main customer pages: no overflow, 44 px controls, 16 px inputs,
  labels, alt text, heading order, contrast fixes, skip link.

## Known limitations after launch (P2)

- Refunds are manual (cancelling a paid order only shows a refund notice).
- Product and category changes are not in the activity log.
- Order detail and payment panel were not re-audited at 375 px with a live customer order.
- No CI pipeline and no frontend/E2E test suite yet.
- Rate limits are per process (fine for one API instance).
