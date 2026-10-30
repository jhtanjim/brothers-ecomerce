# Session state

Updated: **2026-10-30** — multi-store work started (D36): store profiles done, uncommitted.

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

Multi-store plan (D36), stores: Geton (gadgets), Iliyan (menswear), Shatkania Pharmacy. (1) ~~store profiles, theme,
fonts, hero and card variants~~; (2) owner reviews hero wording and supplies logos for `frontend/lib/store.ts`; (3) per-store listing and product page details, gadget specs;
(4) clothing size/colour variants (needs a Prisma migration: ask first; touches cart, checkout, orders);
(5) deployment per store. Launch Geton, then Iliyan, then Shatkania. **Do not sell prescription medicines online until a prescription flow
exists and the owner has confirmed licence and online-sale rules with DGDA (Q12).** Q7/Q8 still open.

Run a store locally: `frontend` (Geton), `frontend-iliyan` or `frontend-shatkania` in `.claude/launch.json`; not both at once.

## Inspect first next time

- `CLAUDE.md`, this file, `docs/LAUNCH-CHECKLIST.md`, latest `docs/WORKLOG.md` entry.
- `git log --oneline -8` for the sprint commits.
