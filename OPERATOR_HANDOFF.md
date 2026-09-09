# GLV Management System Operator Handoff

This file is for AI coding agents and human operators who need to continue work
without rediscovering the system from scratch.

## Project Identity

- App: GLV Management System for God's Love Ventures.
- Purpose: Manage layaway/installment customers, product accounts, payments,
  staff, procurement signals, credits/refunds, reports, settings, and audit logs.
- Stack: Next.js App Router on Next 16, React 19, Auth.js v5 credentials auth,
  Prisma, Supabase Postgres, Tailwind CSS, lucide-react.
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
- `/settings/legal`: Super Admin legal-template editor and customer selector for
  generating addressed Terms and Conditions.
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
- New accounts automatically create addressed Terms and Conditions. Terms are
  manually regenerated from Settings, not from ordinary account pages.
- Cancellation calculations appear only for CLOSED/CANCELLED accounts.
  Reactivation calculations appear only after the lifecycle eligibility check.
- Customer communications queue exactly one enabled channel. Legal/document
  messages prefer email, then WhatsApp, then SMS. Payment receipts prefer
  WhatsApp, then SMS, then email. If no email or phone exists, no outbound
  message is queued; staff show the receipt/tracking record and explain terms
  verbally.

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

- Configure Resend/Twilio credentials before enabling production email, SMS, or
  WhatsApp delivery. The queue and retry workflow are live.
- Decide whether AI Support conversations should be stored in the database for
  auditability.
- Add support actions only after strict permission checks and confirmation UI.
- Continue wiring Settings fields downstream only when the owner asks for those
  business rules to take effect.

## SMS integration with BMS Africa

- Configure `MNOTIFY_API_KEY`, `MNOTIFY_SENDER_ID=GODS LOVE V`, and `CRON_SECRET`
  on the server. The sender was verified approved in the signed-in BMS dashboard.
  API contract: https://developer.bms.africa/#tag/SMS/operation/campaign/sms_quick
  Never log the API request URL because BMS authenticates using a query parameter.
- Apply migration `20260909090000_sms_notifications` before enabling SMS in Settings.
  Credential configuration and live activation are separate from implementation.
- Database migrations are deployed explicitly with `npm run db:deploy` from a trusted
  operator environment using `DATABASE_URL_UNPOOLED`. Vercel's `npm run build` does
  not deploy migrations because its runtime database URL uses Supavisor transaction
  mode on port 6543. Apply and verify migrations before pushing a dependent release.
- Salary: one SMS per saved salary payment, queued in the payroll transaction.
  Welcome: one SMS per new product payment plan, sent no earlier than its start date.
  Progress: once per account when recorded payments reach or exceed 70% of target;
  edits also evaluate the threshold. Existing salary/welcome events are not backfilled.
- Weekly reminder: ACTIVE or OVERDUE accounts with balance > 0, after seven full
  days since the latest of start date, latest payment date and payment entry time.
  Backdated payments reset the interval. At most one reminder per unpaid week.
  Completed, closed, cancelled, suspended, archived, dormant and probation accounts
  are excluded. A payment or lifecycle change suppresses obsolete queued reminders.
- `/api/cron/sms-notifications` requires `Authorization: Bearer <CRON_SECRET>`.
  Vercel schedule: daily at 09:00 UTC/Ghana. Dispatches up to 100 messages in groups
  of five. Qualifying mutations and authenticated notification polling also drain
  pending messages. Monitor backlog; larger deployments need a more frequent scheduler.
- Super administrators open `/settings/sms` from Settings to configure the master
  SMS enable switch, verify the BMS API/sender status, review all four automatic
  notification rules, inspect the latest 100 messages, and retry FAILED entries
  after fixing their cause. ACCEPTED means
  provider acceptance, not handset delivery; check BMS campaign history with its ID.
  Missing/invalid phones are recorded as FAILED. HTTP 429 retries hourly, up to five
  attempts. UNKNOWN results (timeouts/interrupted workers) require BMS reconciliation
  before any manual resend. Turning the SMS setting off pauses sends and new events.
- Queue events use unique dedupe keys and transactional insertion; conditional claims
  protect concurrent dispatch. Backups include the SMS log; restored PENDING or
  PROCESSING entries become UNKNOWN to prevent re-sending messages accepted since backup.
- Verification: `npx tsx --test scripts/sms.test.ts`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build`. Run `npm run db:deploy` separately before releasing schema changes.
  Production migration, authenticated UI and real SMS delivery remain separate gates.

## Retired Staff Inventory Details

- Staff product inventory allocation has been deactivated.
- Staff, customer, account, product, report, notification, backup, and restore
  flows no longer create, consume, restore, export, or display staff stock.
- Historical production tables/columns from the old inventory experiment are not
  dropped automatically; they are left untouched to avoid destructive live data
  changes.
