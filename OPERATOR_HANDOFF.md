# GLV Management System Operator Handoff

This file is for AI coding agents and human operators who need to continue work
without rediscovering the system from scratch.

## Project Identity

- App: GLV Management System for God's Love Ventures.
- Purpose: Manage layaway/installment customers, product accounts, payments,
  staff, procurement signals, credits/refunds, reports, settings, and audit logs.
- Stack: Next.js App Router on Next 16, React 19, Auth.js v5 credentials auth,
  Prisma, Neon Postgres, Tailwind CSS, lucide-react.
- Workspace: `C:\Users\andre\glv-management-system`.
- Main branch: `main`.

## Durable Agent Rules

- Read `AGENTS.md` before code edits. `CLAUDE.md` points to `AGENTS.md`.
- This is Next 16; read the relevant guide in `node_modules/next/dist/docs/`
  before changing pages, route handlers, layouts, data fetching, or auth.
- Keep changes additive and targeted. The owner does not want restarts,
  redesigns, or architecture rewrites unless explicitly requested.
- Preserve staff/admin role boundaries. Do not only hide restricted data in the
  UI; gate or shape it server-side too.
- For GLV UI responsiveness, prefer horizontal scroll wrappers around dense
  operational tables using `overflow-x-auto` plus stable `min-w-[...]` values.

## Verification Gates

Run these before claiming a production-ready change:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

`npm run build` runs `prisma migrate deploy && prisma generate && next build`.
On Windows, Prisma can hit an `EPERM` rename lock on
`query_engine-windows.dll.node` if local GLV dev/build workers are holding the
engine. Stop only GLV-related Node/Next processes, then rerun the gate. Do not
kill unrelated Node processes.

If `next build` fails on stale `.next/dev/types/validator.ts`, remove only the
generated `.next/dev` folder inside this project and rerun the build.

## Authentication Guardrails

The first-login/password-reset loop was previously fixed. Do not regress it.

- `app/api/change-password/route.ts` must update `mustChangePassword` to `false`.
- It must return a `NextResponse.redirect(...)` with
  `clearAuthCookiesOnResponse(request, response)` attached.
- `lib/auth.config.ts` intentionally lets `/login` render when the only issue is
  a stale `mustChangePassword` token, so users are not trapped back at
  `/change-password`.
- Debug the route, outgoing cookies, and `authorized()` callback together.

## Current System Shape

- `/dashboard`: role-shaped dashboard; admins see business metrics, staff see
  assigned operational metrics.
- `/customers`: customer list, filters, staff assignment, customer detail.
- `/accounts`: customer product accounts, lifecycle status, delivery status,
  payment entry points, product/price correction for admins.
- `/payments`: payment recording and grouped searchable payment history.
- `/products`: product catalog plus procurement tab. Procurement items appear
  when product accounts cross the configured payment threshold and are not paid
  off yet.
- `/staff`: staff records, detail view, applications, salary support, password
  reset flow, and per-staff product inventory allocation/restock.
- `/credits`: overpayment credits and refunds.
- `/reports`: admin financial intelligence and salary tracking.
- `/activity`: collection/activity charts.
- `/audit-logs`: read-only audit history.
- `/settings`: broad admin control panel. Important: many fields are stored but
  not fully wired downstream yet. Always distinguish "saved" from "effective".
- AI Support: floating chat bubble rendered in the protected app shell for
  admins only. Staff do not see it and are blocked by the support API route to
  avoid paid API usage.

## Recent Endpoint And UI Work

- `app/api/notifications/route.ts` exposes protected computed attention counts.
  It groups module badges for account/customer follow-up, today's customer,
  account, and payment activity, procurement readiness, product image hygiene,
  open credits/refunds, staff applications, profile approvals, inactive staff
  assignment risk, salary balances, and database-backup review.
- Sidebar badges are locally dismissed when opened and the destination page
  shows an "Attention needed here" callout for the opened notification.
- Wide list/detail tables were hardened for mobile with scroll wrappers in:
  Accounts, Customers, Customer detail, Account detail, Staff detail,
  Staff Applications, Audit Logs, Reports salary tracking.
- `app/api/support/assistant/route.ts` calls OpenAI server-side only when
  `OPENAI_API_KEY` is configured.
- `components/ai-support-chat.tsx` renders the floating support chat UI.

## AI Support Configuration

Set these environment variables server-side:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` is optional. If unset, the support route uses its built-in default.
Never expose `OPENAI_API_KEY` to client components.

The in-app assistant is intentionally scoped to GLV workflows and appears as a
bottom-right floating chat bubble on protected pages for admins only. It should
help admins understand navigation, permissions, payments, accounts, products,
procurement, staff workflows, reports, settings, and troubleshooting. It should
not reveal passwords, bypass permissions, provide legal/financial advice, or
claim it has changed records.

## Current Caveats

- The support assistant is non-persistent. Chats are held in browser state only.
- The assistant does not query full business records. It uses a compact system
  context and the current user's role.
- Browser-based visual checks may fail in some Codex Windows sessions because
  the in-app browser connector can fail before opening. If that happens, state
  the limitation and rely on code audit plus lint/type/build gates.
- Prisma `package.json#prisma` config emits a deprecation warning during build.
  It is not currently blocking.

## Good Next Tasks

- Add outbound notification providers only after choosing email/SMS/WhatsApp
  vendors. Current notifications are in-app attention badges; settings toggles
  for external channels are stored but do not send messages yet.
- Decide whether AI Support conversations should be stored in the database for
  auditability.
- Add support actions only after strict permission checks and confirmation UI.
- Continue wiring Settings fields downstream only when the owner asks for those
  business rules to take effect.

## Retired Staff Inventory

- Staff product inventory allocation has been deactivated.
- Staff, customer, account, product, report, notification, backup, and restore
  flows no longer create, consume, restore, export, or display staff stock.
- Historical production tables/columns from the old inventory experiment are not
  dropped automatically; they are left untouched to avoid destructive live data
  changes.
