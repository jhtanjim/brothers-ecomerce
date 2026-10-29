# CLAUDE.md

E-commerce platform for a Bangladesh store (BDT, Asia/Dhaka, manual bKash/Nagad payments).
npm workspaces modular monolith: NestJS REST API + Next.js storefront/admin + PostgreSQL via Prisma.
Setup and command reference: `README.md` (do not duplicate it here).

## Context documents

| File                       | Use it for                                                                |
| -------------------------- | ------------------------------------------------------------------------- |
| `docs/SESSION-STATE.md`    | Handoff: where the last session stopped, what to do next. **Read first.** |
| `docs/WORKLOG.md`          | Chronological record of completed tasks (newest at the bottom).           |
| `docs/STATUS.md`           | Feature status, architecture, known issues, baseline check results.       |
| `docs/DECISIONS.md`        | Confirmed technical/business decisions and open questions.                |
| `docs/LAUNCH-CHECKLIST.md` | What must happen before real customers; owner vs developer tasks.         |

## Start-of-session rules (token efficiency)

1. Read `CLAUDE.md` and `docs/SESSION-STATE.md`.
2. Read the latest relevant entry in `docs/WORKLOG.md`. Open `docs/STATUS.md` / `docs/DECISIONS.md` only when the task touches them.
3. Check Git status before modifying anything (the folder may still not be a Git repo — see SESSION-STATE).
4. Inspect only files directly related to the task and their necessary dependencies.
5. Do not repeat a full project audit unless explicitly asked or the docs are demonstrably stale.
6. Read focused sections (grep / line ranges) instead of whole files when that is enough.
7. Do not re-run checks that already passed unless code affecting them changed.
8. After each approved implementation task: update `docs/SESSION-STATE.md` and append ONE concise entry to `docs/WORKLOG.md` (update STATUS/DECISIONS only if they changed).
9. Keep docs concise and non-duplicated; each fact lives in one file.
10. When notes conflict with the current code, the code wins — fix the notes.

## Layout

```
backend/   NestJS 11 API  -> http://localhost:4000/api/v1
  src/<module>/        controller(s) + service(s) + dto/ per feature; admin-*.controller.ts for /admin routes
  src/common/          guards, decorators, response interceptor, exception filter, money/pagination utils
  prisma/              schema.prisma, migrations/, seed.ts
frontend/  Next.js 15 App Router -> http://localhost:3000
  app/(store) app/(auth) app/admin    routes
  components/<area>/                  UI by feature
  lib/api/<resource>.ts               typed API calls via lib/api/client.ts
```

## Conventions (follow existing code)

- Every route requires a login cookie unless marked `@Public()`; admin routes use `@Roles(Role.ADMIN)` at class level.
- Responses are wrapped by the interceptor: `{ success, data, message, meta? }`; services return `{ data, meta }` for paginated lists.
- Errors: throw Nest exceptions with `{ message, code }` (UPPER_SNAKE code). Never leak Prisma errors.
- Money: integer cents in application code (`common/utils/money.ts`), `Decimal(12,2)` in DB, decimal strings in API output.
- Multi-row business changes run in `prisma.$transaction`; lock the ORDER row first for order/payment changes.
- DTOs validate with class-validator; the global ValidationPipe rejects unknown fields.
- Frontend calls the API only through `lib/api/*` (same-origin `/api/v1` proxied by `next.config.ts`).
- Prettier: single quotes, trailing commas, width 100. Format only files you touch unless told otherwise.
- No new dependencies, refactors, or duplicate implementations without approval.

## Safety rules

- Preserve existing uncommitted work; never overwrite unrelated changes.
- Never commit, push, deploy, or `git init` without explicit approval.
- Never run migrations, `db:seed`, `prisma migrate`, `db push`, or destructive SQL without explicit approval.
- `npm test -w backend` runs integration specs that TRUNCATE every table in the `_test` database — ask first.
  Pure unit specs are safe: `coupon-calculator`, `order-pricing`, `order-transitions`, `image-signature`.
- Never print, copy, or document secret values from `backend/.env` or `frontend/.env.local`; refer to key names only.
- Ask before significant architectural or business-rule decisions.

## Checks (run what is relevant, report actual results)

```
npm run typecheck                         # backend + frontend
npm run lint                              # backend + frontend
npx prettier --check <changed files>
cd backend && npx vitest run <spec files> # unit specs; integration specs need approval
```

Report pre-existing failures (baseline in `docs/STATUS.md`) separately from failures you introduced.
Never claim a check passed unless you ran it and it passed.
