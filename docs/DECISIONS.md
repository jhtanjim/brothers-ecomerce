# Decisions

Confirmed decisions only, as implemented in code (recorded 2026-10-29 from the initial audit).
Add new entries at the bottom with a date. Unresolved items go under "Open questions".

## Architecture

- **D1 — Modular monolith, no Docker.** npm workspaces `backend/` + `frontend/`; local PostgreSQL. (`README.md`, root `package.json`)
- **D2 — Same-origin API proxy.** The browser calls `/api/v1/*` on the Next.js origin; `next.config.ts` rewrites to
  NestJS. Keeps HTTP-only cookies simple and avoids CORS/CSRF complexity.
- **D3 — Secure by default.** Global JwtAuthGuard + RolesGuard; routes opt out with `@Public()`, admin routes use
  `@Roles(ADMIN)` under `/admin/*` controllers. Frontend admin gating is UX-only. (`app.module.ts`, `AdminShell.tsx`)
- **D4 — API envelope.** Success `{ success, data, message, meta? }`, error `{ success:false, message, code, details? }`;
  stable UPPER_SNAKE error codes; raw DB errors never reach clients. (`response.interceptor.ts`, `all-exceptions.filter.ts`)
- **D5 — Env validated at boot.** App refuses to start on missing/invalid config; JWT secrets ≥ 32 chars and distinct;
  Cloudinary keys required. (`config/env.validation.ts`)

## Auth

- **D6 — Cookie-based JWT.** Access token (15 min) in `access_token` cookie (path `/`); refresh token (30 days) in
  `refresh_token` cookie scoped to `/api/v1/auth/refresh`. Both HTTP-only, SameSite=lax, Secure in production.
- **D7 — Refresh rotation with reuse detection.** Refresh tokens are stored hashed, grouped by `familyId`; reusing a
  rotated token revokes the whole family. The frontend shares one in-flight refresh call. (`auth.service.ts`, `lib/api/client.ts`)
- **D8 — Argon2id** for passwords; password reset tokens are random, stored as SHA-256 hashes, 30-min TTL, single use;
  a reset revokes all sessions.

## Money and pricing

- **D9 — BDT, integer cents.** All calculations in integer cents (`common/utils/money.ts`); DB `Decimal(12,2)`;
  API returns decimal strings like `"1250.00"`. Single pricing source: `orders/order-pricing.ts`.
- **D10 — Prices come from the server.** Order DTO accepts shipping details, payment method and coupon code only;
  products/quantities/prices are read from the server-side cart and locked product rows.
- **D11 — Delivery charge by city.** Home city (default Dhaka) vs other cities, optional free-shipping threshold;
  values are DB settings with code fallbacks. Current values are seed placeholders (see open questions).
- **D12 — Coupons.** PERCENTAGE or FIXED, optional min order / max discount / usage limit / per-user limit / date window;
  applied after product discounts, before delivery; re-validated under a row lock at order time. (`coupon-calculator.ts`)

## Orders, inventory, payments

- **D13 — Stock reserved at order creation** with a conditional decrement (cannot oversell); restored on cancel.
  Lock order: cart → coupon → products (by productId); order/payment changes lock the ORDER row first.
- **D14 — Idempotent checkout.** `POST /orders` requires an `Idempotency-Key` header; repeats return the same order.
- **D15 — Order lifecycle.** PENDING_PAYMENT → (payment approval only) PROCESSING → CONFIRMED → SHIPPED → DELIVERED;
  CANCELLED allowed from PENDING_PAYMENT/PROCESSING/CONFIRMED. DELIVERED and CANCELLED are final. (`order-transitions.ts`)
- **D16 — One cancellation path.** Customer, admin and expiry cancels all go through `OrderCancellationService`
  (restores stock, frees coupon use, closes pending submissions, writes history). Customers can cancel only
  PENDING_PAYMENT orders whose payment is not under review.
- **D17 — Manual bKash/Nagad payments (V1).** Customer submits transaction ID (+ optional private screenshot);
  admin approves (order → PROCESSING, soldCount incremented) or rejects (order stays PENDING_PAYMENT with a fresh
  expiry window). Max attempts is a setting (default 3). Transaction IDs are unique per method except rejected ones.
- **D18 — Unpaid orders expire** after a setting (default 24 h); expiry is paused while a payment is under review.
- **D19 — Refunds are manual in V1.** Cancelling a paid order only reports `refundNeeded`.
- **D20 — Snapshots.** Order items snapshot product name/SKU/image/price; orders snapshot the shipping address.
- **D21 — Products referenced by orders are never hard-deleted**; they are archived. Order numbers are human-readable
  (prefix + Dhaka date + random suffix); IDs are cuids.

## Data and testing

- **D22 — DB-level safety nets.** CHECK constraints and partial unique indexes in migration `20260928120000`.
- **D23 — Integration tests use a separate `_test` database** and refuse to run otherwise (`src/test/db.ts`).
- **D24 — Admin actions are logged in the same transaction** as the change (`activity-logs.service.ts`).
- **D29 — Account checked on every request (2026-10-29).** `JwtAuthGuard` loads the user's `status` and `role`
  after verifying the access token; a missing or non-ACTIVE user gets 401 `ACCOUNT_UNAVAILABLE`, and the DB role
  (not the token role) is used. Cost: one primary-key lookup per authenticated request.
- **D30 — Reset links are never logged in production (2026-10-29).** Until an email provider exists (Q7), password
  reset cannot deliver mail in production; the mailer logs a warning without the link or address.
- **D31 — `pg_trgm` stays a manual setup step (owner, 2026-10-29; answers Q11).** No migration change, because
  editing an applied migration changes its checksum. `npm run db:check` detects a missing extension (dev, test,
  shadow) and a missing or unsafe `SHADOW_DATABASE_URL`, and exits non-zero with the fix.
- **D32 — Design system (2026-10-29).** One accent palette `brand` (green, `tailwind.config.ts`) replaces
  `indigo` everywhere; neutrals `slate`; emerald/amber/rose for success/warning/error and discounts. Fonts via
  `next/font` (self-hosted): Plus Jakarta Sans + Noto Sans Bengali fallback (renders the Taka sign). Cards show
  "Only N left" at <= 5 units (public API has no per-product threshold). Overlays that must cover the screen are
  portalled to `document.body` (the sticky header uses backdrop-blur).
- **D33 — Checkout price preview (2026-10-29).** `POST /orders/quote` (authenticated, throttled 30/min,
  read-only) prices the server-side cart for a city and optional coupon with the same `calculateOrderPricing` /
  `evaluateCoupon` as order creation; an unusable coupon is returned as `couponError` instead of failing. A test
  asserts the quoted total equals the placed order's total.
- **D34 — Admin settings (2026-10-29).** `GET/PATCH /admin/settings` (ADMIN). PATCH sends only changed fields;
  null clears the free-delivery threshold or a merchant number (that method then shows "not set up"). Each save is one
  transaction with a `SETTINGS_UPDATED` activity log holding from/to values. GET returns effective values (defaults
  applied) plus the raw stored merchant text and whether it is usable. The page shows a change summary to confirm.
- **D35 — Customer suspension (2026-10-29).** `/admin/customers` lists and changes role CUSTOMER only (admins are
  invisible there, so an admin cannot suspend an admin or themself). Suspending revokes all refresh tokens and is
  logged (`CUSTOMER_SUSPENDED` / `CUSTOMER_REACTIVATED`, optional reason); existing orders are unchanged.

## Multiple stores (owner, 2026-10-30)

- **D36 — One codebase, one deployment per store.** Each store has its own domain, API process, database, admin and
  settings. `NEXT_PUBLIC_STORE_ID` (build time) picks a profile in `frontend/lib/store.ts` (name, wording, palette,
  layout, fonts); an unknown id fails the build. No shared multi-tenant database. **Replaced by D37 for now.**
- **D37 — Single store: BROTHERS (owner, 2026-10-30).** A men's fashion store. No tenant IDs, tenant resolution, tenant
  billing or per-store switching. Brand details live in `frontend/lib/store.ts`; palette and fonts in
  `tailwind.config.ts` and `app/layout.tsx`.

## Catalog (owner approved, 2026-10-30)

- **D38 — Options are variants with their own stock.** `ProductVariant` holds size, colour, SKU and stock; price stays on the
  product. With variants, `Product.stockQuantity` is always their sum, kept in the same transaction with the product row locked
  first. A variant with order history cannot be deleted (cancelling must restore it). Categories allow one level of
  subcategories; hiding a parent hides its children.

## POS (owner, 2026-10-30)

- **D39 — Counter sales are orders.** `Order.channel = POS`, status DELIVERED, paid in cash, bKash or Nagad, `userId` = the admin who sold. They share stock,
  reports and order pages with online orders, and are left out of that admin's own order history. A counter discount is stored in
  `couponDiscount` with no coupon code. Only admins can sell; cancelling a sale restores stock and the cash refund is manual.

## Workflow (owner answers, 2026-10-29)

- **D25 — Git:** initialize a local repo with a baseline commit of the existing state; no remote yet. Pushing still needs approval.
- **D26 — Prettier:** fix the existing drift in ONE format-only commit right after the baseline; afterwards keep all files formatted.
- **D27 — `backend/scripts/tmp-coupon-cancel.ts`:** delete it (its scenario is covered by integration specs).
- **D28 — Integration specs** may be run against `ecommerce_dev_test` (they truncate that DB only) without asking each time.

## Open questions (unresolved — ask the owner)

- Q12 — Shatkania Pharmacy will sell all medicine types: which licence and online-sale rules apply (DGDA)? Prescription
  flow (upload, pharmacist approval), expiry and batch tracking are not built.
- Q5 — Guest checkout needed?
- Q6 — Real delivery charges, home city, free-shipping threshold?
- Q7 — Email provider (Resend / SMTP / other)?
- Q8 — Deployment target and production database setup?
- Q9 — When (if ever) to add a payment gateway?
- Q10 — Is there a phase plan or requirements document (README mentions Phases 1–3)?
