# Session state

Updated: **2026-10-29** — 3-day launch sprint finished (Day 3, task 4: mobile/accessibility pass + launch checklist).

## Current status

- Git: branch `main`, no remote, last commit `9dbbc39`. **All sprint work is uncommitted** (owner chose to commit
  later): admin categories/products/customers/settings, auth + log fixes (D29, D30), db:check (D31), design system
  (D32), checkout quote (D33), settings (D34), customers (D35), storefront pages, address book, password reset,
  AuthProvider outage fix, a11y fixes, docs. `.claude/launch.json` is untracked and kept out of commits.
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

1. Ask the owner to approve committing the sprint as focused commits (list them first; never push without approval).
2. Then, depending on the owner's answers to Q7/Q8: email provider integration in `mailer.service.ts`, or
   deployment setup. Otherwise P2: activity log for product/category changes.

## Inspect first next time

- `CLAUDE.md`, this file, `docs/LAUNCH-CHECKLIST.md`, latest `docs/WORKLOG.md` entry.
- `git status --short` to see the uncommitted sprint files grouped by area.
