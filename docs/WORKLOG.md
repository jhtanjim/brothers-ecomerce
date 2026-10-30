# Worklog

One concise entry per completed task, oldest first. No pasted code, conversations, or long logs.

Template:

```
## YYYY-MM-DD — <task>
- Objective:
- Files changed:
- Key decisions:
- Checks run:
- Limitations:
- Next step:
```

## 2026-10-29 — Initial project audit

- Objective: understand the existing codebase without changing it.
- Files changed: none.
- Key decisions: none (findings recorded in `docs/STATUS.md`, open questions in `docs/DECISIONS.md`).
- Checks run: both typechecks pass; frontend lint pass; backend lint 1 error (`scripts/tmp-coupon-cancel.ts`);
  Prettier 117 files fail; 4 unit spec files / 56 tests pass; `prisma validate`, `db:check`, `migrate status` pass.
- Limitations: integration specs, `next build`, server startup and end-to-end flows not run.
- Next step: set up project context docs.

## 2026-10-29 — Project context documentation

- Objective: lightweight context system so future sessions skip the full audit.
- Files changed: created `CLAUDE.md`, `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/WORKLOG.md`, `docs/SESSION-STATE.md`.
  No application, config, dependency, env, schema or migration files touched.
- Key decisions: decisions recorded only where confirmed by code; unresolved items listed as open questions.
- Checks run: re-verified audit facts against current files (no source changes since the audit); no code checks
  re-run (no code changed).
- Limitations: same verification gaps as the audit.
- Next step: Git init + baseline commit, pending owner approval (see `docs/SESSION-STATE.md`).

## 2026-10-29 — Owner answers, Git init, integration baseline

- Objective: record answers to Q1–Q4, initialize Git, get a runtime test baseline.
- Files changed: `docs/DECISIONS.md` (D25–D28), `docs/STATUS.md`, `docs/SESSION-STATE.md`, this file. Created `.git/`.
- Key decisions: Git local only; one Prettier commit; delete tmp script; integration specs allowed on `_test` DB.
- Checks run: `.gitignore` coverage and secret scan of commit candidates (clean); backend `npx vitest run`
  → 10 files, 112 tests pass.
- Limitations: nothing committed yet; frontend build/runtime still unverified.
- Next step: baseline commit after owner confirms the file list.

## 2026-10-29 — Baseline commit

- Objective: put the existing project under version control.
- Files changed: none in the tree; commit `ab7087f` on `main` (251 files). No remote, nothing pushed.
- Checks run: confirmed no `.env`/`.env.local`/build/`node_modules` files staged; working tree clean after commit.
- Next step: hygiene commits (`.gitattributes`, Prettier, delete tmp script, `.env.example` shadow key).

## 2026-10-29 — Repository cleanup

- Objective: clear pre-existing lint/format failures and setup gaps (D26, D27).
- Files changed: added `.gitattributes`; deleted `backend/scripts/tmp-coupon-cancel.ts`; `backend/.env.example`
  (+ `SHADOW_DATABASE_URL` placeholder); Prettier reformatted 115 files (format only); docs updated.
- Key decisions: LF enforced via `.gitattributes`; one format-only commit kept separate from other changes.
- Checks run: typecheck + lint both pass; `prettier --check .` pass; backend `npx vitest run` 10 files / 112 tests pass.
- Limitations: `next build` and runtime flows still not run; `pg_trgm` migration (Q11) and README shadow-DB note open.
- Next step: admin category management UI.

## 2026-10-29 — Admin category management UI

- Objective: let admins manage categories from the UI (backend API already existed).
- Files changed: new `frontend/lib/api/admin-categories.ts`, `frontend/components/admin/CategoriesListContent.tsx`,
  `CategoryForm.tsx`, `CategoryEditContent.tsx`, `frontend/app/admin/categories/{page,new/page,[id]/edit/page}.tsx`;
  edited `frontend/lib/api/types.ts` (category types), `frontend/components/admin/AdminShell.tsx` (nav item).
- Key decisions: mirrors the coupon admin pattern; status changes from the list only; delete disabled while the
  category has products; edit sends `slug`/`imageUrl` only when changed (sending `imageUrl` clears `imagePublicId`).
- Checks run: frontend typecheck, lint, `prettier --check .` pass; 12-step API check via the Next.js proxy pass;
  browser test as admin (validation, create, filters/sort/search, edit + duplicate-slug error, activate/deactivate,
  delete confirm/cancel/delete, not-found page) pass; test category deleted.
- Limitations: `next build` not run; category changes not activity-logged.
- Next step: admin product management UI.

## 2026-10-29 — Sprint day 1, task 1: admin product management UI

- Objective: run the catalog without Postman (P0 for launch).
- Files changed: new `frontend/lib/api/admin-products.ts`, `frontend/components/admin/ProductsListContent.tsx`,
  `ProductForm.tsx`, `ProductImagesManager.tsx`, `ProductEditContent.tsx`,
  `frontend/app/admin/products/{page,new/page,[id]/edit/page}.tsx`; edited `frontend/lib/api/types.ts`
  (product types), `frontend/components/admin/AdminShell.tsx` (Products nav item).
- Key decisions: create → redirect to edit page for images; status changed from the list (activate,
  deactivate, archive, restore-as-inactive); Delete only offered when soldCount is 0 (backend still refuses
  ordered products with 409); primary image always first, others reorderable; client mirrors backend upload limits.
- Checks run: frontend typecheck, lint, `prettier --check .` pass. Browser test as admin: list/filters, form
  validation, create (inactive), edit + clear sale price, Cloudinary upload of 3 generated PNGs, wrong-type
  rejection, reorder, make primary, delete image, archive/restore, delete product — all pass; test product and
  its images deleted (no Cloudinary warnings in logs).
- Limitations: `next build` not run; product changes not activity-logged.
- Next step: commit, then P0 security fixes.

## 2026-10-29 — Sprint day 1, task 2: P0 auth and log fixes

- Objective: suspended/deleted accounts lose access immediately; no reset tokens in production logs.
- Files changed: `backend/src/common/guards/jwt-auth.guard.ts` (async; loads user status + role per request),
  `backend/src/common/mailer/mailer.service.ts` (production: warning only); new
  `jwt-auth.guard.integration.spec.ts` (6 tests), `mailer.service.spec.ts` (2 tests). Decisions D29, D30.
- Checks run: backend typecheck + lint pass; `npx vitest run` 12 files / 120 tests pass; runtime check against the
  running API (public route, 401 without cookie, admin login, `/auth/me`, admin route, garbage token) all pass.
- Limitations: password reset still cannot email anyone in production (Q7).
- Next step: Q11 `pg_trgm` decision, then storefront design work.

## 2026-10-29 — Sprint day 1, task 4: design system, header, mobile menu, home, product card

- Objective: premium, consistent storefront look and a real mobile navigation.
- Files changed: `frontend/tailwind.config.ts` (brand palette, fonts, card shadow), `app/globals.css` (focus
  ring, reduced motion), `app/layout.tsx` (next/font, theme colour), new `components/layout/MobileMenu.tsx`,
  rewritten `components/layout/Header.tsx`, `components/product/ProductCard.tsx`, `app/(store)/page.tsx`;
  small edits to `PriceDisplay.tsx`, `ProductGrid.tsx`, `SectionHeading.tsx`, `HeaderCartLink.tsx`;
  mechanical `indigo-` -> `brand-` class swap in 45 frontend files (storefront + admin). Decision D32.
- Checks run: frontend typecheck, lint, `prettier --check .` pass. Browser (desktop + 375px): header, hero with
  real featured products, category tiles, product cards, Taka sign rendering, no horizontal overflow; mobile
  menu open/Escape/focus return/scroll lock/navigate-closes all pass.
- Bugs found and fixed: Taka sign rendered with a wrong glyph (no Bengali glyphs in the Latin font -> Noto Sans
  Bengali fallback); mobile menu trapped inside the header by backdrop-blur (-> portal).
- Found, not fixed: checkout hides the delivery charge until the order is placed (STATUS issue 15).
- Limitations: product detail, listing, cart, checkout and account pages only got the colour swap, not a redesign;
  `next build` not run.
- Next step: checkout delivery-charge preview, then product detail/listing polish.

## 2026-10-29 — Sprint day 2, task 1: checkout delivery charge and total preview

- Objective: customers see the delivery charge and the amount to pay before placing the order.
- Files changed: new `backend/src/orders/order-quote.service.ts`, `dto/quote-order.dto.ts`,
  `order-quote.integration.spec.ts` (7 tests); `orders.controller.ts` (`POST /orders/quote`), `orders.module.ts`;
  `frontend/lib/api/orders.ts` (`getOrderQuote`), `lib/api/types.ts` (`OrderQuote`),
  `components/checkout/CheckoutForm.tsx` (debounced quote on city/coupon/cart change),
  `components/checkout/CheckoutSummary.tsx` (delivery row, total, free-delivery hint, coupon problem). D33.
- Checks run: typecheck + lint (both apps) pass; backend `npx vitest run` 13 files / 127 tests pass (incl. "quote
  total equals placed order total"); `prettier --check .` pass. Browser: no city -> "Enter your city"; typing ->
  "Calculating..."; Dhaka -> 60 / total 3,050; Sylhet -> 120 / total 3,110 (current dev settings). No order placed.
- Limitations: coupon path verified by tests only (not in the browser); delivery amounts are placeholder settings (Q6).
- Next step: product detail page redesign.

## 2026-10-29 — Sprint day 2, task 2: product detail page

- Objective: a clear, trustworthy product page with obvious buying actions.
- Files changed: `frontend/app/(store)/products/[slug]/page.tsx` (category link, larger title, price card with
  "You save", stock pill, delivery/payment/tracking info panel with true statements only),
  `components/cart/AddToCartButton.tsx` (44px quantity controls, 48px buttons, new Buy now = add + go to
  checkout), `components/product/ProductGallery.tsx` (designed placeholder, rounded corners).
- Checks run: frontend typecheck + lint pass; `prettier --check .` pass. Browser (desktop + 375px): image and
  no-image products, You save amount, stock pill, quantity +/-, Add to cart (cart + header badge updated),
  Buy now (lands on /checkout), no horizontal overflow, touch targets 44-48px. Test cart line removed afterwards.
- Notes: Buy now adds to an existing cart quantity (common convention), it does not replace it.
- Next step: listing + cart pages, then the full purchase journey.

## 2026-10-29 — Sprint day 2, task 3: product listing and cart pages

- Objective: faster product discovery on phones and a clearer cart.
- Files changed: new `frontend/components/product/FiltersDisclosure.tsx` (filters folded behind a button below lg);
  `app/(store)/products/page.tsx` (category chips, removable active-filter chips, heading weight),
  `components/product/ProductFilters.tsx` (radius); `components/cart/CartLineItem.tsx` (44px controls, initial
  placeholder), `components/cart/CartPageContent.tsx` (card summary under sticky header, checkout CTA replaced by
  "Fix the items above" while the cart has issues, clearer delivery note).
- Checks run: frontend typecheck + lint + `prettier --check` pass. Browser: desktop listing with 3 filters (chips
  link to the right URLs, form visible, toggle hidden); 375px (filters folded, badge 3, results in first screen,
  no overflow); cart quantity +1/-1 round trip with summary update; all cart controls 44px. Backend log clean.
- Limitations: the "Fix the items above" cart state was not exercised in the browser (needs an unavailable item);
  the plain GET filter form still works without JS on desktop, but on phones the folded panel needs JS to open.
- Next step: full purchase journey in the browser.

## 2026-10-29 — Sprint day 2, task 4: full purchase journey in the browser

- Objective: verify the real customer and admin journey end to end (owner-approved test data in the dev DB).
- Journey (all passed): register via UI -> add 2 x rice from product page -> checkout validation -> quote total
  2,020 (Dhaka) -> place order ORD-20261029-YWQH3A (total = quote) -> payment form validation -> submit fake
  TESTTXN0001 (under review, expiry paused, cancel hidden; API cancel 409 PAYMENT_UNDER_REVIEW; customer on admin
  API 403) -> admin reject with reason (customer sees reason, 2 attempts left, fresh 24 h window) -> resubmit
  TESTTXN0002 -> admin approve with confirm (Processing, history shows both attempts) -> Mark confirmed -> admin
  cancel (refund warning, stock restored). Order B ORD-20261029-BFZG95 (Sylhet, Nagad, 1,100 = quote) -> customer
  cancel (stock restored, second cancel 409). DB afterwards: rice stock 200 / sold 410 (as before), audit log has
  reject/approve/status/cancel entries, no pending test transactions.
- Bug found and fixed: `frontend/components/auth/AuthProvider.tsx` treated any `/auth/me` failure (network/5xx)
  as signed out, so an API restart bounced signed-in users to /login. Now only 401/403 sign out; other errors retry
  after 1 s, 2 s, 4 s. Verified with the API stopped (page stays, 3 retries) and after restart (normal load).
- Checks run: frontend typecheck + lint pass; `prettier --check` on touched file pass. Backend unchanged.
- Not covered: coupon at checkout in the browser, payment screenshot upload (owner asked not to upload one),
  auto-expiry in real time. Test customer + 2 cancelled orders remain in the dev DB.
- Next step: forgot/reset password pages, then admin settings.

## 2026-10-29 — Sprint day 2, task 5: forgot / reset password pages

- Objective: customers can recover their account without an admin (backend endpoints already existed).
- Files changed: new `frontend/components/auth/ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`,
  `frontend/app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`; `lib/api/auth.ts`
  (`forgotPassword`, `resetPassword`); `components/auth/LoginForm.tsx` ("Forgot password?" link).
- Key decisions: neutral "if an account exists" message; the token is kept in memory and removed from the address
  bar on load; reset page sends no Referer; after a reset the browser session is cleared too.
- Checks run: frontend typecheck + lint + `prettier --check` pass. Browser on the test customer: invalid email
  rejected, neutral confirmation, dev-log link opened, token stripped from URL, referrer=no-referrer, too-short and
  mismatch errors, success message; old password 401, new password 200, reused token 400; bad token and missing
  token states shown with a link to request a new one. Backend log clean.
- Limitations: production has no email provider yet (Q7), so the reset email is not delivered there (D30).
  Test customer password changed (stored in the session scratchpad only).
- Next step: admin settings API + page.

## 2026-10-29 — Sprint day 2, task 6: admin store settings

- Objective: delivery charges, merchant numbers and order rules editable without database access.
- Files changed: new `backend/src/settings/admin-settings.controller.ts`, `admin-settings.service.ts`,
  `dto/update-settings.dto.ts`, `admin-settings.integration.spec.ts` (6 tests); `settings.module.ts` (controller,
  ActivityLogsModule), `activity-logs.service.ts` (SETTINGS_UPDATED). Frontend: new `lib/api/admin-settings.ts`,
  `components/admin/SettingsContent.tsx`, `app/admin/settings/page.tsx`; `lib/api/types.ts`, `AdminShell.tsx`
  (Settings nav). Decision D34.
- Checks run: typecheck + lint both apps pass; `prettier --check .` pass; backend `npx vitest run` 14 files / 133
  tests pass; anonymous GET /admin/settings 401. Browser as admin, NOTHING SAVED: values match the DB, "Nothing has
  changed", validation errors, change summary (60 -> 75, not set -> 5,000), Keep editing, Reset; API confirmed values
  unchanged. Backend log clean.
- Found: bKash and Nagad merchant numbers are identical in the dev DB (owner to confirm; not changed).
- Limitations: an actual save was verified by integration tests only (owner asked not to change stored values).
- Next step: admin customer list + suspend.

## 2026-10-29 — Sprint day 3, task 1: admin customer list and suspension

- Objective: find customers and suspend/reactivate accounts from the admin.
- Files changed: new `backend/src/customers/` (module, controller, service, 2 DTOs,
  `admin-customers.integration.spec.ts` 4 tests); `app.module.ts`; `activity-logs.service.ts` (2 actions).
  Frontend: new `lib/api/admin-customers.ts`, `components/admin/CustomersListContent.tsx`,
  `app/admin/customers/page.tsx`; `lib/api/types.ts`, `AdminShell.tsx` (Customers nav). Decision D35.
- Checks run: typecheck + lint both apps; `prettier --check .`; backend `npx vitest run` 15 files / 137 tests;
  anonymous GET /admin/customers 401. Browser on the test customer: list with order count/last order, admins not
  listed, suspend with reason (login 403 "suspended"), reactivate (login 200), then suspended again and left
  suspended on purpose. Backend log clean.
- Next step: production build (`npm run build`).

## 2026-10-29 — Sprint day 3, task 2: production build

- Objective: confirm both apps build for production.
- Files changed: none (docs only).
- Checks run: `npm run build` exit 0 — `nest build` OK (`backend/dist/main.js`), `next build` compiled, lint +
  type validity OK, 25 routes, no warnings. Run with the API stopped: prerendered pages logged ECONNREFUSED and were
  built with their error/empty state (they revalidate within 60 s). Build outputs are git-ignored.
- Next step: customer address book page.

## 2026-10-29 — Sprint day 3, task 3: customer address book

- Objective: customers manage saved addresses outside checkout (backend API already existed).
- Files changed: new `frontend/components/account/AccountNav.tsx` (My orders / Addresses tabs),
  `components/account/AddressBookContent.tsx`, `app/(store)/account/addresses/page.tsx`;
  `app/(store)/account/orders/page.tsx` (tabs, "My account" heading), `lib/api/addresses.ts` (update, delete),
  `components/auth/HeaderActions.tsx` and `components/layout/MobileMenu.tsx` (Addresses links).
- Checks run: frontend typecheck + lint + `prettier --check` pass. Browser as admin (started with 0 addresses):
  6 validation errors on empty form; add A (auto default); add B as default; checkout pre-filled B and listed both;
  make A default; edit B area; delete B; delete A; back to 0 with empty state. Backend log clean.
- Next step: mobile/accessibility pass, launch checklist.

## 2026-10-29 — Sprint day 3, task 4: mobile/accessibility pass and launch checklist

- Objective: phone-friendly, accessible core pages; a clear list of what remains before real customers.
- Audit (375 px, scripted, per page): overflow, controls under 40 px, unlabeled fields, img alt, unnamed controls,
  heading order — home, listing, product, cart, checkout, account orders/addresses, login, register, forgot.
  No overflow, unlabeled fields, missing alt or unnamed controls found anywhere.
- Fixed: 16 px form text on small screens (stops iOS zoom, `app/globals.css`); 44 px fields/buttons in
  `CheckoutField`, `AuthFormField`, `CouponBox`, all auth submit buttons; bigger hit areas for footer links,
  "View all", breadcrumbs, cart "Clear cart"/"Continue shopping", "Forgot password?"; category chips 40 px;
  listing heading order (sr-only h2); contrast of crossed-out prices and the photo placeholder (slate-400 ->
  slate-500); "Skip to content" link in both shell layouts.
- Checks run: re-audit confirmed every fix (44 px / 16 px values measured); skip link focus order verified with
  the keyboard; typecheck + lint both apps; `prettier --check .`; `npm run build` exit 0, no warnings.
- Added `docs/LAUNCH-CHECKLIST.md` (P0 blockers, owner setup, deploy steps, verified items, P2 limits) and linked
  it from `CLAUDE.md`.
- Limitations: order detail/payment panel not re-audited with a live order; admin pages not audited for mobile.
- Next step: owner approval to commit; then Q7/Q8.

## 2026-10-29 — Sprint committed

- Six focused commits on `main` (owner-approved, not pushed, no remote): `3e6037b` fix(auth), `e216a87`
  chore(setup), `feb19f7` feat(api), `13c8ea5` feat(storefront), `84d8a1a` feat(admin), `3ee1eeb` docs.
  112 files; no env/secret files; `.claude/` left untracked. Checks were last run on this exact tree (all pass).
- Note: intermediate commits were grouped by area and not individually built; the final tree is the verified one.

## 2026-10-30 — Multi-store foundation: store profiles (D36)

- Objective: run visibly different shops (gadgets, clothing) from one codebase.
- Files changed: new `frontend/lib/store.ts`, `components/home/StoreHero.tsx`; `tailwind.config.ts` (brand from CSS
  variables, display font), `app/layout.tsx` (per-store fonts, palette, metadata), `app/globals.css`,
  `lib/format.ts` (`SITE_NAME` from profile), `app/(store)/page.tsx`, `components/product/ProductCard.tsx`,
  `components/admin/SalesChart.tsx` (hard-coded colour), `.env.example`.
- Checks run: frontend typecheck + lint, `prettier --check .`; browser compare of both home pages (name, palette,
  fonts, hero, card shape, no overflow); production build of each store; bad store id fails the build.
- Limitations: names and wording are placeholders; both local stores share the dev DB and catalog; listing, cart and
  checkout differ only by theme and card; no size/colour variants yet. Not committed.
- Next step: owner supplies names; then gadget specs and clothing variants.

## 2026-10-30 — Real store names and pharmacy profile

- Objective: use the owner's businesses: Geton (gadgets), Iliyan (menswear), Shatkania Pharmacy (all medicine types).
- Files changed: `frontend/lib/store.ts` (ids geton, iliyan, shatkania), `components/home/StoreHero.tsx` (search-first
  pharmacy hero), `app/layout.tsx` (Figtree), `.env.example`, docs.
- Limitations: no prescription flow, expiry or batch tracking; prescription medicines must not be sold yet (Q12).
- Next step: owner reviews hero wording; Geton specs.

## 2026-10-30 — BROTHERS storefront design

- Objective: turn the store into BROTHERS, a single men's fashion brand (D37), with multi-tenant work parked.
- Files changed: `frontend/lib/store.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/(store)/page.tsx`,
  `components/home/HomeHero.tsx` (replaces `StoreHero.tsx`), `components/layout/{Header,Footer}.tsx`, `ProductCard`,
  `SectionHeading`; pill shapes squared across `app/` and `components/`.
- Tested: browser, phone-width pane: home, listing, product, sign-in, cart, checkout, placed a bKash order to the payment
  step. Dev DB gained one `brothers-test-*@example.test` customer and unpaid order ORD-20261030-R585B3 (1 jeans reserved
  until it expires on 31 Oct).
- Limitations: no schema change yet, so no sizes, colours, subcategories or material. Homepage shows the sample catalog.
  Admin was restyled only by the shared tokens, and was not opened in the browser.
- Next step: owner approves the catalog migration.

## 2026-10-30 — BROTHERS men's catalog and photos

- Objective: owner asked for a banner, fashion product photos, men's categories, and the non-fashion products removed.
- Files changed: `backend/prisma/sample-catalog.ts` (new), `prisma/seed.ts`, `frontend/public/brand/` (stock photos, Unsplash
  licence), `HomeHero.tsx`, `lib/store.ts`, `app/(store)/page.tsx`.
- Dev DB: one-off script hid 9 old products and 5 old categories (`INACTIVE`, not deleted: order history needs them), added
  8 men's categories and 5 sample products. Seed not run.
- Limitations: prices and stock are invented, photos are stock images; replace both before launch. Local images use a
  `sample/*` public id, so deleting one in admin only logs a Cloudinary warning.
- Next step: owner approves the catalog migration.

## 2026-10-30 — Catalog migration: options, subcategories, flags

- Objective: owner approved the migration for sizes, colours, subcategories, material and new/bestseller flags.
- Files changed: `prisma/schema.prisma`, migration `20261030120000_add_catalog_variants` (additive; applied to dev and `_test`),
  cart, orders, cancellation, products, categories, payments services; `lib/categories.ts`, `AddToCartButton`,
  `ProductFilters`, listing, header, `ProductVariantsManager`, `ProductForm`, `CategoryForm`; `prisma/sample-catalog.ts`.
- Tested: backend vitest 16 files / 148 tests (11 new in `variants.integration.spec.ts`), typecheck, lint, frontend and backend
  builds. Browser: subcategory dropdown, filters, option picker, cart, order to payment step with L / Sky Blue, cancel restored
  stock; admin add and delete option; category parent list. Dev DB gained one more cancelled test order.
- Limitations: one price per product; no size guide or exchange text (needs owner's content). Saving a product through the
  form and the admin subcategory save were not clicked through in the browser; the category rules are covered by tests.
- Next step: owner supplies real products and content; add a remote and push.

## 2026-10-30 — POS for walk-in customers

- Objective: sell at the shop counter and print a receipt, sharing stock with the website.
- Files changed: migration `20261030150000_add_pos_sales` (additive; applied to dev and `_test`, not to Neon),
  `orders/pos.{service,controller}.ts`, `reserveLine` extracted in `orders.service.ts`, `admin/pos` pages, `PosContent`,
  `PosReceiptContent`; online checkout now refuses `CASH`.
- Tested: backend vitest 17 files / 154 tests (6 new in `pos.integration.spec.ts`), typecheck, lint, frontend build. Browser: SKU
  scan-style add, discount, change, sale, receipt, cancel restores stock; test data removed.
- Limitations: cash only, admin login only, whole-sale cancel only, needs internet. Not tried on a real 80mm printer or scanner.
- Next step: test on the shop's printer; finish deployment (Render `DATABASE_URL`).

## 2026-10-30 — POS bKash/Nagad and daily report

- Objective: take mobile payments at the counter and check sales at closing.
- Files changed: `orders/pos.service.ts`, `create-pos-sale.dto.ts`, `dashboard.service.ts` (`dailyReport`), `PosContent`,
  `PosReceiptContent`, `DailyReportContent`, `app/admin/reports`. No migration.
- Behaviour: bKash and Nagad need a transaction ID, recorded as an approved `PaymentTransaction`, so an ID cannot be reused online
  or in the shop. Report at `/admin/reports` groups one Dhaka day by channel and method.
- Tested: backend vitest 17 files / 156 tests, typecheck, lint, builds. Browser: bKash sale, repeated ID refused, cash sale, report
  totals; test data removed.
- Limitations: staff check the bKash/Nagad payment on their own phone; the system does not verify it. Report has no opening cash.
- Next step: exchanges and returns (needs a migration).
