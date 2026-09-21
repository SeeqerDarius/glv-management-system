import type { ReactNode } from "react";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { UserPermission } from "@prisma/client";
import {
  ArrowDownUp,
  Banknote,
  Boxes,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDollarSign,
  DownloadIcon,
  HandCoins,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { recordStaffSalary, deleteStaffSalary } from "@/actions/salaries";
import {
  deleteStaffDeposit,
  recordStaffDeposit,
} from "@/actions/staff-deposits";
import { ReportAnalyticsCharts } from "@/components/reports/analytics-charts";
import {
  Cell,
  MetricCard,
  MetricGroup,
  ReportSection,
  ReportTable,
  Row,
  SectionNav,
  type MetricTone,
} from "@/components/reports/report-layout";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { UndoNotice, UndoPanel } from "@/components/undo-panel";
import { listUndoableActions } from "@/lib/undo";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { ProductImagePreview } from "@/components/product-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { todayDateInputValue } from "@/lib/date-rules";
import {
  getCurrentWeekRange,
  getWeeklyCollectionTrend,
  getWeeklyStaffPerformanceReport,
} from "@/lib/reports";
import { hasPermission, isAdminRole } from "@/lib/roles";
import { salaryMonthInputValue } from "@/lib/salary-periods";

export const dynamic = "force-dynamic";

const TREND_WEEKS = 8;

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "staff-performance", label: "Staff Performance" },
  { id: "staff-deposits", label: "Deposits" },
  { id: "salary-tracking", label: "Salaries" },
  { id: "product-profitability", label: "Products" },
];

function weekParam(date: Date) {
  const { start } = getCurrentWeekRange(date);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
}

function resolveSelectedDate(weekQuery: string | undefined) {
  const now = new Date();
  if (!weekQuery) return now;

  const parsed = new Date(`${weekQuery}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return now;

  const { start: currentWeekStart } = getCurrentWeekRange(now);
  const { start: requestedWeekStart } = getCurrentWeekRange(parsed);
  return requestedWeekStart > currentWeekStart ? now : parsed;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Positive figures are good news everywhere except costs and shortfalls. */
function signTone(value: number): MetricTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border p-2.5 text-sm outline-none transition-colors focus:border-lime-500";

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      className={`rounded-md border p-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-lime-200 bg-lime-50 text-lime-900"
      }`}
    >
      {children}
    </p>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  const canViewReports =
    isAdminRole(session?.user?.role) ||
    hasPermission(
      session?.user?.role,
      session?.user?.permissions,
      UserPermission.VIEW_REPORTS
    );
  const query = await searchParams;
  let report: Awaited<ReturnType<typeof getWeeklyStaffPerformanceReport>>;
  let trend: Awaited<ReturnType<typeof getWeeklyCollectionTrend>>;

  if (!canViewReports) {
    return (
      <div className="rounded-lg border bg-white p-5">
        <h1 className="text-xl font-semibold text-gray-950">
          You do not have permission to view reports.
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Use the dashboard, customers, accounts, and payments pages for your
          assigned operational work.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const selectedDate = resolveSelectedDate(query.week);

  try {
    [report, trend] = await Promise.all([
      getWeeklyStaffPerformanceReport(selectedDate),
      getWeeklyCollectionTrend(TREND_WEEKS, selectedDate),
    ]);
  } catch (error) {
    console.error("REPORTS_LOAD_ERROR", error);
    return (
      <DatabaseUnavailable
        retryHref="/reports"
        title="Reports are temporarily unavailable"
      />
    );
  }

  const isAdmin = isAdminRole(session?.user?.role);
  const undoableActions = isAdmin
    ? await listUndoableActions({
        entities: ["StaffDeposit", "StaffSalaryPayment"],
      })
    : [];
  const isCurrentWeek = weekParam(selectedDate) === weekParam(new Date());
  const previousWeekDate = new Date(report.start);
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const nextWeekDate = new Date(report.start);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const exportHref = `/api/reports/weekly-export?week=${weekParam(selectedDate)}`;
  const weekLabel = `${formatDate(report.start)} - ${formatDate(report.end)}`;

  const today = todayDateInputValue();
  const selectedWeek = weekParam(selectedDate);
  const depositDate = dateInputValue(
    report.end < new Date() ? report.end : new Date()
  );
  const earliestDepositDate = new Date(report.start);
  earliestDepositDate.setDate(earliestDepositDate.getDate() - 7);
  const depositErrorMessage =
    query.depositError === "missing-staff"
      ? "Choose a staff member."
      : query.depositError === "invalid-amount"
        ? "Deposit amount must be greater than zero."
        : query.depositError === "invalid-date"
          ? "Choose a valid deposit date."
          : query.depositError === "future-date"
            ? "Deposit date cannot be in the future."
            : query.depositError === "not-found"
              ? "Deposit record could not be found."
              : query.depositError === "expired-form"
                ? "This form expired. Refresh the page and try again."
                : "Unable to record the staff deposit.";
  const defaultSalaryMonth = salaryMonthInputValue();
  const maxSalaryMonth = salaryMonthInputValue(new Date());
  const salaryError = query.salaryError;
  const salaryErrorMessage =
    salaryError === "future-date"
      ? "Salary payment date cannot be in the future."
      : salaryError === "future-salary-month"
        ? "Salary month cannot be in the future."
        : salaryError === "invalid-salary-month"
          ? "Choose a valid salary month."
          : "Unable to record salary payment. Check the staff, amount, and date.";

  const { summary } = report;
  const varianceTone: MetricTone =
    summary.weeklyDepositVariance < 0
      ? "negative"
      : summary.weeklyDepositVariance > 0
        ? "watch"
        : "positive";
  const varianceLabel =
    summary.weeklyDepositVariance < 0
      ? "Deposit Shortage"
      : summary.weeklyDepositVariance > 0
        ? "Deposit Surplus"
        : "Deposit Variance";
  const varianceHint =
    summary.weeklyDepositVariance < 0
      ? "Collected but not yet banked."
      : summary.weeklyDepositVariance > 0
        ? "Banked more than was recorded."
        : "Banked exactly what was recorded.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Financial Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            GLV financial position and staff performance for {weekLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-white">
            <Link
              href={`/reports?week=${weekParam(previousWeekDate)}`}
              className="flex size-9 items-center justify-center text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
              aria-label="Previous week"
            >
              <ChevronLeftIcon className="size-4" />
            </Link>
            {isCurrentWeek ? (
              <span className="border-x px-3 py-2 text-xs font-medium text-gray-500">
                This Week
              </span>
            ) : (
              <Link
                href="/reports"
                className="border-x px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950"
              >
                This Week
              </Link>
            )}
            {isCurrentWeek ? (
              <span className="flex size-9 items-center justify-center text-gray-300">
                <ChevronRightIcon className="size-4" />
              </span>
            ) : (
              <Link
                href={`/reports?week=${weekParam(nextWeekDate)}`}
                className="flex size-9 items-center justify-center text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
                aria-label="Next week"
              >
                <ChevronRightIcon className="size-4" />
              </Link>
            )}
          </div>
          <Button asChild>
            <Link href={exportHref} download>
              <DownloadIcon className="size-4" />
              Export Weekly Report
            </Link>
          </Button>
        </div>
      </div>

      <SectionNav items={SECTIONS} />

      <UndoNotice undone={query.undone} undoError={query.undoError} />

      {isAdmin ? (
        <UndoPanel actions={undoableActions} returnTo="/reports" />
      ) : null}

      <ReportSection
        id="overview"
        title="Business Overview"
        description="Every figure below is for the selected week unless the card says otherwise."
      >
        <div className="space-y-4">
          <MetricGroup
            title="Collections and Banking"
            description="What customers paid this week and how much of it reached the company account."
          >
            <MetricCard
              label="Recorded This Week"
              value={formatMoney(summary.weeklyRecordedCollections)}
              hint="Payments entered by staff."
              icon={ReceiptText}
            />
            <MetricCard
              label="Deposited This Week"
              value={formatMoney(summary.weeklyDeposits)}
              hint="Cash banked against those payments."
              icon={Landmark}
            />
            <MetricCard
              label={varianceLabel}
              value={formatMoney(Math.abs(summary.weeklyDepositVariance))}
              hint={varianceHint}
              icon={ArrowDownUp}
              tone={varianceTone}
            />
            <MetricCard
              label="Total Collected"
              value={formatMoney(summary.totalCollected)}
              hint="All payments, all time."
              icon={Wallet}
            />
          </MetricGroup>

          <MetricGroup
            title="Receivables and Exposure"
            description="Money still owed to GLV and the capital already committed to stock."
          >
            <MetricCard
              label="Outstanding Balance"
              value={formatMoney(summary.totalOutstandingBalance)}
              hint="Owed across all live accounts."
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Expected Receivables"
              value={formatMoney(summary.totalExpectedReceivables)}
              hint="Owed on active and overdue plans only."
              icon={Target}
            />
            <MetricCard
              label="Product Cost Exposure"
              value={formatMoney(summary.totalProductCost)}
              hint="Cost of the goods behind those plans."
              icon={Boxes}
            />
          </MetricGroup>

          <MetricGroup
            title="Payroll"
            description="Salary commitments for the month being settled."
          >
            <MetricCard
              label="Current Month Payroll"
              value={formatMoney(summary.currentMonthPayroll)}
              hint="Total salary due this month."
              icon={Users}
            />
            <MetricCard
              label="Salary Paid for Due Month"
              value={formatMoney(summary.totalSalaryPaid)}
              icon={HandCoins}
            />
            <MetricCard
              label="Outstanding Salaries"
              value={formatMoney(summary.outstandingSalaries)}
              hint="Still to be paid for the due month."
              icon={Banknote}
              tone={summary.outstandingSalaries > 0 ? "watch" : "positive"}
            />
            <MetricCard
              label="Payroll % of Revenue"
              value={`${summary.payrollPercentageOfRevenue.toFixed(1)}%`}
              hint="Share of income going to salaries."
              icon={Scale}
            />
          </MetricGroup>

          <MetricGroup
            title="Profitability"
            description="Where the business stands once cost of goods and payroll are taken out."
          >
            <MetricCard
              label="Net Profit So Far"
              value={formatMoney(summary.netProfitSoFar)}
              hint="Collected less product cost and salaries paid."
              icon={PiggyBank}
              tone={signTone(summary.netProfitSoFar)}
            />
            <MetricCard
              label="Payroll vs Income"
              value={formatMoney(summary.payrollVsIncome)}
              hint="Monthly income less monthly payroll."
              icon={Scale}
              tone={signTone(summary.payrollVsIncome)}
            />
            <MetricCard
              label={summary.gainLossStatus}
              value={formatMoney(summary.projectedNetProfit)}
              hint="If every live plan runs to completion."
              icon={summary.projectedNetProfit < 0 ? TrendingDown : TrendingUp}
              tone={signTone(summary.projectedNetProfit)}
            />
          </MetricGroup>
        </div>
      </ReportSection>

      <ReportSection
        id="analytics"
        title="Analytics"
        description="Collection trends, account health, and top performers at a glance."
      >
        <ReportAnalyticsCharts
          trend={trend.map((week) => ({
            label: formatDate(week.start),
            collected: week.collected,
            isSelected: week.isSelected,
          }))}
          accountStatus={report.accountStatusBreakdown}
          staffPerformance={report.rows.map((row) => ({
            code: row.staffCode,
            name: row.staffName,
            value: row.weeklyCollection,
          }))}
          productProfitability={report.products
            .slice()
            .sort((a, b) => b.expectedLayawayProfit - a.expectedLayawayProfit)
            .slice(0, 8)
            .map((product) => ({
              name: product.name,
              value: product.expectedLayawayProfit,
            }))}
        />
      </ReportSection>

      <ReportSection
        id="staff-performance"
        title="Staff Weekly Performance"
        description={`Ranked by collections for ${weekLabel}. Scroll sideways for the full ledger; the staff column stays in view.`}
      >
        <ReportTable
          minWidthClass="min-w-[1320px]"
          isEmpty={report.rows.length === 0}
          emptyMessage="No staff performance to report for this week."
          columns={[
            { label: "Staff", sticky: true },
            { label: "Customers", align: "right" },
            { label: "Active", align: "right" },
            { label: "Contract Value", align: "right" },
            { label: "Weekly Recorded", align: "right" },
            { label: "Weekly Deposited", align: "right" },
            { label: "Deposit Variance", align: "right" },
            { label: "Monthly Collection", align: "right" },
            { label: "Total Collected", align: "right" },
            { label: "Outstanding", align: "right" },
            { label: "Due Month Salary", align: "right" },
            { label: "Paid for Due Month", align: "right" },
            { label: "Salary Balance", align: "right" },
            { label: "Projected After Payroll", align: "right" },
          ]}
        >
          {report.rows.map((row) => (
            <Row key={row.staffId}>
              <Cell sticky>
                <div className="flex items-center gap-3">
                  <Badge variant={row.rank === 1 ? "default" : "secondary"}>
                    #{row.rank}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-semibold">{row.staffCode}</p>
                    <p className="truncate text-xs text-gray-500">
                      {row.staffName}
                    </p>
                  </div>
                </div>
              </Cell>
              <Cell align="right" numeric>
                {row.assignedCustomers}
              </Cell>
              <Cell align="right" numeric>
                {row.activeAccounts}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.totalContractValue)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.weeklyCollection)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.weeklyDeposited)}
              </Cell>
              <Cell
                align="right"
                numeric
                className={`font-semibold ${
                  row.depositVariance < 0
                    ? "text-red-700"
                    : row.depositVariance > 0
                      ? "text-blue-700"
                      : "text-green-700"
                }`}
              >
                {row.depositVariance < 0
                  ? `Shortage ${formatMoney(Math.abs(row.depositVariance))}`
                  : row.depositVariance > 0
                    ? `Surplus ${formatMoney(row.depositVariance)}`
                    : "Balanced"}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.monthlyCollection)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.totalCollected)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.outstandingBalance)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.monthlySalary)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.salaryPaidThisMonth)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.salaryBalanceThisMonth)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(row.projectedProfitAfterSalary)}
              </Cell>
            </Row>
          ))}
        </ReportTable>
      </ReportSection>

      <ReportSection
        id="staff-deposits"
        title="Staff Deposits"
        description={`Money physically deposited into company accounts, compared with payments entered for ${weekLabel}.`}
      >
        {query.depositError ? (
          <Notice tone="error">{depositErrorMessage}</Notice>
        ) : null}
        {query.depositRecorded ? (
          <Notice tone="success">Staff deposit recorded.</Notice>
        ) : null}
        {query.depositDeleted ? (
          <Notice tone="success">Staff deposit deleted.</Notice>
        ) : null}

        {isAdmin ? (
          <form
            action={recordStaffDeposit}
            className="rounded-lg border bg-white p-4"
          >
            <p className="mb-3 text-sm font-semibold text-gray-950">
              Record a deposit
            </p>
            <input type="hidden" name="week" value={selectedWeek} />
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Field label="Staff">
                <select name="staffId" className={inputClass} required>
                  <option value="">Select staff</option>
                  {report.rows.map((row) => (
                    <option key={row.staffId} value={row.staffId}>
                      {row.staffCode} - {row.staffName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount Deposited">
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  required
                />
              </Field>
              <Field
                label="Deposit Date"
                hint="You may backdate into the previous week. It will appear in the report for that date."
              >
                <input
                  name="depositDate"
                  type="date"
                  defaultValue={depositDate}
                  min={dateInputValue(earliestDepositDate)}
                  max={dateInputValue(
                    report.end < new Date() ? report.end : new Date()
                  )}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Channel">
                <select name="channel" className={inputClass}>
                  <option value="Cash Deposit">Cash Deposit</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Reference">
                <input
                  name="reference"
                  className={inputClass}
                  placeholder="Slip or transaction ID"
                />
              </Field>
              <Field label="Notes">
                <input
                  name="notes"
                  className={inputClass}
                  placeholder="Optional note"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end border-t pt-3">
              <SubmitButton pendingLabel="Recording">
                Record Deposit
              </SubmitButton>
            </div>
          </form>
        ) : null}

        <ReportTable
          minWidthClass="min-w-[1050px]"
          isEmpty={report.staffDeposits.length === 0}
          emptyMessage="No staff deposits recorded for this week."
          columns={[
            { label: "Deposit Date" },
            { label: "Staff", sticky: true },
            { label: "Amount", align: "right" },
            { label: "Channel" },
            { label: "Reference" },
            { label: "Recorded By" },
            { label: "Notes" },
            ...(isAdmin
              ? [{ label: "Action", align: "right" as const, srOnly: true }]
              : []),
          ]}
        >
          {report.staffDeposits.map((deposit) => (
            <Row key={deposit.id}>
              <Cell>{formatDate(deposit.depositDate)}</Cell>
              <Cell sticky>
                <p className="font-semibold">{deposit.staff.code}</p>
                <p className="text-xs text-gray-500">
                  {deposit.staff.fullName}
                </p>
              </Cell>
              <Cell align="right" numeric className="font-semibold">
                {formatMoney(deposit.amount)}
              </Cell>
              <Cell>{deposit.channel || "-"}</Cell>
              <Cell>{deposit.reference || "-"}</Cell>
              <Cell>{deposit.recordedByName}</Cell>
              <Cell>{deposit.notes || "-"}</Cell>
              {isAdmin ? (
                <Cell align="right">
                  <div className="flex justify-end">
                    <ConfirmDeleteForm
                      action={deleteStaffDeposit}
                      id={deposit.id}
                      title="Delete staff deposit?"
                      description="This removes the deposit record and recalculates the staff variance."
                      hiddenFields={{ week: selectedWeek }}
                      triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125" />
                    </ConfirmDeleteForm>
                  </div>
                </Cell>
              ) : null}
            </Row>
          ))}
        </ReportTable>
      </ReportSection>

      <ReportSection
        id="salary-tracking"
        title="Monthly Staff Salary Tracking"
        description="Payroll is tracked by the salary month being settled, separate from the date it was actually paid."
      >
        {salaryError ? <Notice tone="error">{salaryErrorMessage}</Notice> : null}
        {query.salaryRecorded ? (
          <Notice tone="success">Salary payment recorded.</Notice>
        ) : null}

        <form action={recordStaffSalary} className="rounded-lg border bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-gray-950">
            Record a salary payment
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field label="Staff">
              <select name="staffId" className={inputClass} required>
                <option value="">Select staff</option>
                {report.rows.map((row) => (
                  <option key={row.staffId} value={row.staffId}>
                    {row.staffCode} - {row.staffName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Salary Month" hint="The month being settled.">
              <input
                name="salaryMonth"
                type="month"
                defaultValue={defaultSalaryMonth}
                max={maxSalaryMonth}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Payment Date" hint="When the money actually left.">
              <input
                name="paymentDate"
                type="date"
                defaultValue={today}
                max={today}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Notes">
              <input
                name="notes"
                className={inputClass}
                placeholder="Optional note"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end border-t pt-3">
            <SubmitButton pendingLabel="Recording">Record Salary</SubmitButton>
          </div>
        </form>

        <ReportTable
          minWidthClass="min-w-[920px]"
          isEmpty={report.salaryPayments.length === 0}
          emptyMessage="No salary payments recorded."
          columns={[
            { label: "Payment Date" },
            { label: "Salary Month" },
            { label: "Staff", sticky: true },
            { label: "Amount", align: "right" },
            { label: "Paid By" },
            { label: "Notes" },
            { label: "Action", align: "right", srOnly: true },
          ]}
        >
          {report.salaryPayments.map((payment) => (
            <Row key={payment.id}>
              <Cell>{formatDate(payment.paymentDate)}</Cell>
              <Cell>{formatMonth(payment.salaryMonth)}</Cell>
              <Cell sticky>
                <p className="font-semibold">{payment.staff.code}</p>
                <p className="text-xs text-gray-500">
                  {payment.staff.fullName}
                </p>
              </Cell>
              <Cell align="right" numeric className="font-semibold">
                {formatMoney(payment.amount)}
              </Cell>
              <Cell>{payment.paidByName}</Cell>
              <Cell>{payment.notes || "-"}</Cell>
              <Cell align="right">
                <div className="flex justify-end">
                  <ConfirmDeleteForm
                    action={deleteStaffSalary}
                    id={payment.id}
                    title="Delete salary payment?"
                    description="This removes a financial salary record and creates an audit entry."
                    triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
                  </ConfirmDeleteForm>
                </div>
              </Cell>
            </Row>
          ))}
        </ReportTable>
      </ReportSection>

      <ReportSection
        id="product-profitability"
        title="Product Profitability / Procurement"
        description="Layaway returns based on the number of customer accounts using each product."
      >
        <ReportTable
          minWidthClass="min-w-[1180px]"
          isEmpty={report.products.length === 0}
          emptyMessage="No products to report on yet."
          columns={[
            { label: "Product", sticky: true },
            { label: "Cost", align: "right" },
            { label: "Transport", align: "right" },
            { label: "Daily", align: "right" },
            { label: "Duration", align: "right" },
            { label: "Layaway", align: "right" },
            { label: "Accounts", align: "right" },
            { label: "Layaway Profit", align: "right" },
            { label: "Expected Revenue", align: "right" },
            { label: "Expected Profit", align: "right" },
          ]}
        >
          {report.products.map((product) => (
            <Row key={product.id}>
              <Cell sticky>
                <div className="flex min-w-0 items-center gap-3">
                  <ProductImagePreview
                    src={product.imageUrl}
                    alt={product.name}
                    className="size-10 bg-white"
                    previewTitle={product.name}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                  </div>
                </div>
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.costPrice)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.transportCost)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.dailyAmount)}
              </Cell>
              <Cell align="right" numeric>
                {product.duration} days
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.layawayPrice)}
              </Cell>
              <Cell align="right" numeric>
                {product.accountCount}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.layawayProfit)}
                <span className="block text-xs text-gray-500">
                  {product.layawayProfitPercentage.toFixed(1)}%
                </span>
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.expectedLayawayRevenue)}
              </Cell>
              <Cell align="right" numeric>
                {formatMoney(product.expectedLayawayProfit)}
              </Cell>
            </Row>
          ))}
        </ReportTable>
      </ReportSection>
    </div>
  );
}
