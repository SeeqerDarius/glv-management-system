# GLV Management System Operator Handoff

## Dashboard figure reference

- `docs/GLV_Dashboard_and_Business_Overview_Guide.pdf` explains every administrator
  dashboard figure, the staff dashboard figures, and every Business Overview figure
  on Reports. It states the record scope, calculation, reporting period, and practical
  interpretation, including the difference between operational estimates and formal
  accounting profit.
- Regenerate the guide with `docs/build_dashboard_figures_guide.py` whenever a card,
  formula, lifecycle inclusion rule, salary period, or weekly deposit calculation changes.

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
  payment entry points, product/price correction for admins. Admins can also
  deliver to a trusted customer before the plan is paid off. See "Delivery with
  an outstanding balance" below.
- `/payments`: payment recording and grouped searchable payment history.
- `/products`: product catalog plus procurement tab. Procurement items appear
  when product accounts cross the configured payment threshold and are not paid
  off yet. Operators confirm the quantity actually bought, and that many units
  leave the list. See "Procurement confirmation" below.
- `/staff`: staff records, detail view, applications, salary support, password
  reset flow, and per-staff product inventory allocation/restock.
- `/credits`: overpayment credits and refunds.
- `/reports`: admin financial intelligence and salary tracking.
- `/activity`: collection/activity charts.
- `/audit-logs`: read-only audit history.
- `/settings`: Super Admin control panel, organised as tabs driven by `?tab=`:
  Company, Business Rules, Payroll, Notifications, Security, Appearance,
  Product Categories, and Data & System. Each tab saves on its own and writes
  only its own columns. Important: many fields are stored but not fully wired
  downstream yet. Always distinguish "saved" from "effective".
- `/settings/legal`: Super Admin legal-template editor and customer selector for
  generating addressed Terms and Conditions.
- AI Support: floating chat bubble rendered in the protected app shell for
  admins only. Staff do not see it and are blocked by the support API route to
  avoid paid API usage. Backed by Groq; see "AI Support Configuration".
- The floating calculator widget has been removed. `components/calculator-widget.tsx`
  is deleted and the app shell no longer renders it. AI Support is now the only
  floating bubble.

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
- Every form submit control across the app now shows a pending/loading state
  and disables itself while its server action is in flight, closing the gap
  where a slow request let staff click Save/Record/Approve/Reject/Delete
  repeatedly and create duplicate records. `components/ui/submit-button.tsx`
  wraps the shadcn `Button`; `components/ui/plain-submit-button.tsx` covers
  bespoke `<button>` markup (icon-only actions, inline table buttons). Both
  read `useFormStatus`, so they work inside Server Component forms without
  those pages needing `useActionState`. Client components that already
  manage their own submission (`useActionState`/local `pending` state, e.g.
  payment, customer, account, product, staff forms) were left as-is. Native
  GET filter/sort forms (Accounts, Customers, Payments, Products, Staff,
  Credits, Audit Logs) were intentionally left alone: they do not call a
  server action, so `useFormStatus` cannot see them, and the route's
  `loading.tsx` already covers the navigation.
- The dashboard (`app/dashboard/page.tsx`) replaced its wall of plain numbers
  with real charts and week-over-week trend indicators. The admin view now
  has a "Trends" section (`components/dashboard-analytics.tsx`
  `AdminDashboardCharts`) with a weekly collections line/area chart and an
  account-status breakdown bar chart; the staff view gets its own scoped
  weekly collections chart (`StaffDashboardTrendChart`). The existing
  hand-rolled dependency-free SVG chart system from the Reports page
  (`components/reports/analytics-charts.tsx`) was extracted into
  `components/reports/chart-primitives.tsx` (`ChartCard`, `TrendChart`,
  `HorizontalBarChart`, `Tooltip`, plus a new `TrendBadge`) so both Reports
  and Dashboard share one implementation instead of duplicating ~300 lines
  of SVG. `TrendBadge` shows a green up-arrow / red down-arrow / grey dash
  comparing this week to last week; per the dataviz skill's contrast rule it
  colors only the icon and keeps the label text in the neutral
  `--chart-ink-secondary` token, since `--chart-good` green fails 4.5:1 text
  contrast on white at small sizes (icon-only color use only needs 3:1,
  which it passes).
  `lib/reports.ts` gained `getAdminDashboardTrend`/`getStaffDashboardTrend`
  and `getWeeklyCollectionTrend` gained an optional `staffId` filter. Deltas
  are only computed for flow metrics that are safely reconstructible from
  immutable `createdAt`/`paymentDate` history (new customers/staff/accounts
  this week vs last week, collected this week/today vs the prior period).
  Status-based snapshot figures (Active/Overdue/Completed accounts, cash
  position) intentionally show no arrow: the `status` column has no history
  table, so there is no honest way to reconstruct "as it was last week" for
  those — showing a fabricated delta there would be worse than showing none.
  The Business Dashboard screenshot in the training manual
  (`documentation/screenshots/01-dashboard.png`) was not recaptured (no
  database access in this sandbox to render the live page); the manual's
  description text was updated to match the new page, but the embedded image
  is now stale until someone regenerates it from a real environment.
- The four dashboard KPI cards that have a real previous-period value
  (Total Customers, Total Staff, New Accounts This Week, Collected This
  Week for admins; My Customers, Collected Today, Collected This Week for
  staff) now render as an animated analog meter
  (`components/reports/meter-gauge.tsx` `AnimatedMeter`, composed into
  `components/dashboard-analytics.tsx` `GaugeMetricCard`) instead of a
  static number. Per the dataviz skill's form table ("a single ratio
  against a limit -> Meter, same-ramp track"), each is a semicircular
  progress arc in one hue. On page load the arc animates from last week's
  position to this week's (a `requestAnimationFrame`-delayed CSS
  transition on `stroke-dashoffset`, double-buffered so the browser paints
  the starting position before the transition fires; skipped when
  `prefers-reduced-motion` is set), and a static tick mark stays on the
  track at the previous position so both ends of the movement are still
  visible after it settles — growth visibly advances the arc, decline
  visibly pulls it back. The numeric value is always shown beneath the arc
  (never color/position alone). For Total Customers/Total Staff/My
  Customers, whose headline number is a cumulative total rather than a
  weekly count, the previous-week total is reconstructed as
  `current total - this week's new count` — valid because those records
  are effectively immutable (not backdated or bulk-deleted), the same
  integrity standard already used for the `TrendBadge` deltas. Metrics
  without an honest previous value (Active/Overdue Accounts, cash
  position, etc.) were intentionally left as plain `MetricCard`s.
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

AI Support runs on Groq. Set these environment variables server-side (Vercel
project settings for production, `.env.local` for local development):

```env
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
```

`GROQ_MODEL` is optional. When unset, `lib/ai-support.ts` uses its built-in
candidate list. Groq retires hosted models on notice, so the route tries the
configured model first and falls through the remaining production models when a
model comes back unknown or decommissioned. That keeps the assistant answering
after a retirement instead of failing until someone ships a code change. If
every candidate is rejected, the chat says to set `GROQ_MODEL` to a current
Groq model, which is the whole fix.

Never expose `GROQ_API_KEY` to client components and never commit it. The key
is read only inside the server route.

The system prompt in `lib/ai-support.ts` carries GLV's real operating
knowledge: modules and their page paths, role boundaries, the payment edit
window, the procurement threshold, the procurement confirmation step, the
deliver-with-balance rule, and the SMS rules. Keep it aligned with `lib/`
whenever a workflow changes, or the assistant will confidently describe
behaviour the system no longer has.

The in-app assistant is intentionally scoped to GLV workflows and appears as a
bottom-right floating chat bubble on protected pages for admins only. It should
help admins understand navigation, permissions, payments, accounts, products,
procurement, staff workflows, reports, settings, and troubleshooting. It should
not reveal passwords, bypass permissions, provide legal/financial advice, or
claim it has changed records.

## Current Caveats

- The support assistant is non-persistent. Chats are held in browser state only.
- The assistant does not query full business records. It uses the GLV knowledge
  prompt in `lib/ai-support.ts`, the current user's role and permissions, and a few
  live settings values (currency, procurement threshold, payment edit window, SMS
  on/off). It cannot answer "what is customer X's balance" and is told to say so and
  point at the page that shows it.
- `api.groq.com` is not reachable from every sandboxed agent session, so the Groq
  integration may not be live-testable during development. Verify it in a deployed
  environment with `GROQ_API_KEY` set.
- Browser-based visual checks may fail in some Codex Windows sessions because
  the in-app browser connector can fail before opening. If that happens, state
  the limitation and rely on code audit plus lint/type/build gates.
- `documentation/build_glv_system_manual.py` and `docs/build_system_documentation.py`
  are kept current and both DOCX deliverables were regenerated for the
  procurement confirmation, deliver-with-balance, SMS rule, Groq and settings
  changes. `soffice --headless --convert-to pdf` still cannot regenerate the
  matching PDFs in this sandbox: it fails to load even a trivial one-line test
  file (`Error: source file could not be loaded`, no PDF written, before it
  touches either GLV file), so this remains a broken LibreOffice
  install/sandbox limitation rather than a content problem, and no alternative
  converter is installed. The two `.pdf` files under `docs/` and
  `documentation/` are therefore stale relative to their `.docx`/generator
  sources until someone re-runs
  `soffice --headless --convert-to pdf --outdir <dir> <file>.docx` (or opens
  and exports each `.docx` from Word/LibreOffice) on a machine with a working
  install. Regenerating the training-manual DOCX also needs
  `pip install --target documentation/.docx_deps python-docx Pillow`, because
  `documentation/.docx_deps/` is gitignored.
- Prisma `package.json#prisma` config emits a deprecation warning during build.
  It is not currently blocking.

## Migrations Pending Deployment

Apply these with `npm run db:deploy` from a trusted operator environment using
`DATABASE_URL_UNPOOLED`, before releasing the dependent code. Vercel's
`npm run build` does not deploy migrations.

| Migration | Adds |
| --- | --- |
| `20260917090000_sms_weekly_summary_short_template` | `Setting.smsWeeklySummaryShortTemplate` for the below-target weekly summary. |
| `20260917091000_procurement_confirmation` | `CustomerAccount.procuredAt`, `procuredBy`, and an index on `procuredAt`. |
| `20260917092000_delivery_with_outstanding_balance` | `CustomerAccount.deliveredWithBalance`, `balanceAtDelivery`, `deliveryNote`. |

Until `20260917091000` is applied the procurement query fails, because
`procuredAt: null` is part of its filter. Deploy the migrations first.

Also set `GROQ_API_KEY` in the Vercel project environment before expecting AI
Support to answer. Without it the chat returns the "not configured yet" message.

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
- Missed-payment reminder: ACTIVE or OVERDUE accounts with balance > 0, after
  **fourteen full days (two weeks)** since the latest of start date, latest payment
  date and payment entry time. Backdated payments reset the interval. At most one
  reminder per further unpaid fortnight, so the sequence is day 14, day 28, day 42.
  The window lives in `MISSED_PAYMENT_WINDOW_MS` / `MISSED_PAYMENT_WINDOW_DAYS`
  in `lib/sms-rules.ts`; change it there rather than in the template text.
  Completed, closed, cancelled, suspended, archived, dormant and probation accounts
  are excluded. A payment or lifecycle change suppresses obsolete queued reminders.
  The editable Missed payment template supports `{{staffName}}`, resolved from the
  customer's assigned staff profile and rendered as that staff member's first name.
- Weekly payment summary: recording a staff deposit is the end-of-week settlement
  trigger. GLV totals that staff member's customers' Payment records from Monday
  through Sunday across all their product accounts, then queues one summary for each
  customer whose total is greater than zero. The key is unique by staff, customer,
  and week, so another deposit cannot duplicate an accepted summary. A later deposit
  refreshes the amount and the wording only while the summary remains PENDING.
  Customers who paid nothing that week receive no summary, and no customer receives
  another staff member's totals.
- The weekly summary has **two wordings** and GLV picks one per customer. The
  expected weekly amount is the daily amount of every plan that customer is still
  collecting on (ACTIVE, OVERDUE or PROBATION with a balance), multiplied by seven.
  Paying at or above that amount sends the encouraging "target met" message.
  Paying less sends the separate "below target" message, which carries the target
  and the shortfall and asks the customer to contact their staff member. The
  praise wording is therefore never sent to a customer who fell short. A customer
  with no collecting plan counts as on target, because there is nothing to fall
  short of. The comparison is done in pesewas so float noise cannot turn an exact
  week into a shortfall.
- **No phone number means no message at all.** A customer or staff member whose
  number is missing or unusable is skipped before anything is queued: no row is
  created, no failed entry is logged, and the provider is never called for them.
  If a number is cleared after a message was queued, dispatch retires that message
  as CANCELLED rather than attempting a send that cannot arrive. Fix the phone
  number on the customer or staff record and the next qualifying event queues
  normally.
- `/api/cron/sms-notifications` requires `Authorization: Bearer <CRON_SECRET>`.
  Vercel schedule: daily at 09:00 UTC/Ghana. Dispatches up to 100 messages in groups
  of five. Qualifying mutations and authenticated notification polling also drain
  pending messages. Monitor backlog; larger deployments need a more frequent scheduler.
- Super administrators open `/settings/sms` from Settings to configure the master
  SMS enable switch, verify the BMS API/sender status, review all five automatic
  notification rules, inspect the latest 100 messages, and retry FAILED entries
  after fixing their cause. ACCEPTED means
  provider acceptance, not handset delivery; check BMS campaign history with its ID.
  HTTP 429 retries hourly, up to five
  attempts. UNKNOWN results (timeouts/interrupted workers) require BMS reconciliation
  before any manual resend. Turning the SMS setting off pauses sends and new events.
  Records with no usable phone number produce no log entry at all, so an operator
  chasing a missing message should check the phone number on the customer or staff
  record first rather than looking for a FAILED row.
- Queue events use unique dedupe keys and transactional insertion; conditional claims
  protect concurrent dispatch. Backups include the SMS log; restored PENDING or
  PROCESSING entries become UNKNOWN to prevent re-sending messages accepted since backup.
- Verification: `npx tsx --test scripts/sms.test.ts`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build`. Run `npm run db:deploy` separately before releasing schema changes.
  Production migration, authenticated UI and real SMS delivery remain separate gates.
- Super administrators can edit six templates on Settings > SMS: Salary payment,
  Customer welcome, 70% progress, Missed payment, Weekly summary - target met, and
  Weekly summary - below target. The below-target message is stored in
  `Setting.smsWeeklySummaryShortTemplate` (migration
  `20260917090000_sms_weekly_summary_short_template`) and is the only template that
  offers `{{shortfallAmount}}`; both weekly templates offer `{{expectedAmount}}`. Each editor lists only the
  placeholders valid for that message and shows a sample preview. Templates cannot
  be empty, exceed 612 characters, or contain an unavailable/incomplete placeholder.
  Saving affects newly queued notifications only; an existing queue row keeps its
  reviewed message snapshot. Reset all restores GLV's six defaults. Salary messages
  resolve only to the staff member on that salary payment; the other three resolve
  only to the customer on the qualifying account. A missing or invalid phone number
  means the message is never queued and never sent to anyone else.
- Default message text is branded `Rock Frost Group`, and staff/customer name
  placeholders render only the first whitespace-delimited name. The BMS handset
  sender is `Rock Frost`, which fits the provider's 11-character limit and must be
  approved in the BMS account before `MNOTIFY_SENDER_ID` is changed in production.

## Settings pane layout

- Settings is organised as tabs driven by `?tab=`: `company`, `operations`,
  `payroll`, `notifications`, `security`, `appearance`, `catalog`, `data`. Staff and
  Admins see only Appearance; Super Admins see all of them.
- **Each tab saves on its own.** `updateSettings` takes the section being saved and
  writes only that section's columns, validating only that section's fields. This is
  load-bearing, not cosmetic: the action previously wrote every column on every
  submit, so once the form was split across tabs, a tab that did not render a field
  would have blanked it and flipped every unrendered checkbox to false. If a new
  field is added, register it in one section in `actions/settings.ts` and render it
  on that tab.
- Section keys live in `lib/settings-sections.ts`, not in `actions/settings.ts`,
  because a `"use server"` module may only export async functions. Moving them back
  breaks the build.
- The first save on a fresh system must come from **Company**, because
  `companyName` and `phone` are required columns. Any other section attempted before
  a Setting row exists redirects with `company-required-first` and explains this.
- The appearance, product-category and database-restore actions redirect back to
  their own tab, so feedback lands on the section that produced it. A new action
  that redirects to `/settings` should include its `tab=`.
- Data & System holds backup, restore, weekly report import, and the **System
  Notes** fields. Those notes are operator-maintained labels only; editing
  "Database Status" or "Neon Status" changes nothing about the live infrastructure.
  The tab says so, and support answers should too.

## Procurement confirmation

- The procurement list is still a computed view. A product appears once at least
  one of its pending-delivery accounts is at or above the configured threshold.
- Operators now confirm what they actually bought. Enter the quantity on the
  procurement tab (`/products?tab=procurement`) or on the product procurement page
  (`/products/procurement/[productId]`) and press **Confirm procured**. That many
  units leave the list immediately.
- Confirmation is recorded per account, not per product: `CustomerAccount.procuredAt`
  and `procuredBy` (migration `20260917091000_procurement_confirmation`). Units are
  consumed starting with the customers closest to finishing their plan, which is the
  order GLV buys in. A partial purchase therefore reduces the outstanding count by
  exactly the quantity entered and leaves the rest on the list.
- Single units can be confirmed individually from the product procurement page,
  which is the safer route when a specific customer's unit was bought out of order.
- Confirming does not change delivery. A confirmed unit moves to the **Bought,
  awaiting delivery** table on the product procurement page and stays there until
  delivery is confirmed on the account. That table has an **Undo** action that puts
  the unit back on the buying list, for confirmations entered in error.
- `procuredAt: null` is part of the shared procurement query, so every consumer
  reduces together: the products tab, the sidebar attention badge, the procurement
  Excel export, the weekly report sheet, and the reports module. There is no second
  source of truth to keep in step.
- Confirming requires `MANAGE_PRODUCTS` (admins have it implicitly). Both confirm
  and undo are audit logged as `CONFIRM_PROCUREMENT` and
  `UNDO_CONFIRM_PROCUREMENT`, recording the requested quantity, the confirmed
  quantity and the account IDs. Two operators confirming at once cannot consume the
  same unit twice: the update is guarded on `procuredAt` still being null, and the
  redirect reports the quantity actually confirmed.

## Delivery with an outstanding balance

- Some consistent customers receive their product before finishing payment. An
  **Admin or Super Admin** can confirm that from the account page via **Deliver with
  balance owing**. Staff cannot, even for their own customers, because releasing
  goods against an unpaid balance is an owner-level decision.
- The dialog requires a written reason and an explicit acknowledgement. Both the
  reason and the balance owed at handover are stored on the account
  (`deliveredWithBalance`, `balanceAtDelivery`, `deliveryNote`; migration
  `20260917092000_delivery_with_outstanding_balance`) and captured in the audit log
  as `DELIVER_ACCOUNT_WITH_OUTSTANDING_BALANCE`. `balanceAtDelivery` is frozen at
  handover, so later payments never hide how much credit was extended.
- The account stays open and collectible. It is not marked COMPLETED and it is not
  archived, so the debt stays visible in the accounts list, on the customer page and
  in reports. Collection continues until the balance reaches zero, at which point
  the account completes and archives on the normal schedule.
- Early delivery is only offered while the plan is still being collected on
  (ACTIVE, OVERDUE, PROBATION or COMPLETED). A cancelled, closed, suspended or
  archived plan is rejected server-side with `delivery-not-collectible`.
- The fully-paid path is unchanged: a COMPLETED account with a zero balance is
  marked delivered by anyone who can manage that account, with no reason required.
- On-credit delivery shows as a blue truck badge, distinct from the green
  fully-paid badge, on the accounts list, the customer page and the account page.
  An admin can reverse it with **Mark pending**, which clears all three fields.
- Two consequences of this feature were fixed at the same time and must not
  regress:
  - Reactivating a dormant account no longer wipes a delivery that already
    happened. Previously any non-COMPLETED outcome reset delivery to PENDING.
  - The lifecycle sweep no longer issues a closure refund credit for an account
    whose product was already delivered. Auto-closing such an account used to
    refund most of what the customer had paid while they kept the goods. What
    remains on a delivered account is a receivable, not a refundable deposit.

## Integrated Business Management

- Administrators open `/business` from the single **Business Management** sidebar item. The page keeps People, Payroll, Accounting, and Analytics together; these are sections of one GLV workflow, not separately activated modules.
- People uses the existing `Staff` record and adds leave requests with approve/reject decisions plus dated 1-to-5 performance reviews. Every write is administrator-only and audit logged.
- Payroll uses the existing staff monthly salary and `StaffSalaryPayment` history. Recording salary from Business Management uses the same transaction, validation, and staff-only salary SMS as the detailed Reports workflow.
- Accounting treats customer `Payment` rows as cash inflow and saved salary payments plus `BusinessExpense` rows as cash outflow. Staff deposits reconcile collections and are not counted again as revenue. Operators can record dated expenses with category, payment method, reference, and notes.
- Analytics calculates the current month revenue, payroll paid and outstanding, operating expenses, net cash, headcount, pending leave, review average, and all-time cash position directly from those shared records.
- Apply migration `20260909183000_integrated_business_management` before deploying the route. The legacy version-1 database restore does not yet include leave, review, or expense tables. Do not use an old full-database restore as the recovery method for these records; retain database-level backups until a versioned restore upgrade is released.
- Verification: Prisma generate, TypeScript, lint, build, explicit migration deployment, authenticated `/business` review, and production error-log review.

## Retired Staff Inventory Details

- Staff product inventory allocation has been deactivated.
- Staff, customer, account, product, report, notification, backup, and restore
  flows no longer create, consume, restore, export, or display staff stock.
- Historical production tables/columns from the old inventory experiment are not
  dropped automatically; they are left untouched to avoid destructive live data
  changes.
