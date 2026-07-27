import Link from "next/link";
import { UserPermission } from "@prisma/client";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, Trash2 } from "lucide-react";
import { recordStaffSalary, deleteStaffSalary } from "@/actions/salaries";
import {
  deleteStaffDeposit,
  recordStaffDeposit,
} from "@/actions/staff-deposits";
import { ReportAnalyticsCharts } from "@/components/reports/analytics-charts";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { ProductImagePreview } from "@/components/product-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function SummaryCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`glv-metric-card rounded-lg border p-4 ${emphasis ? "bg-lime-50" : "bg-white"}`}>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-gray-950">{value}</p>
    </div>
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
    return <DatabaseUnavailable retryHref="/reports" title="Reports are temporarily unavailable" />;
  }

  const isCurrentWeek = weekParam(selectedDate) === weekParam(new Date());
  const previousWeekDate = new Date(report.start);
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const nextWeekDate = new Date(report.start);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const exportHref = `/api/reports/weekly-export?week=${weekParam(selectedDate)}`;

  const today = todayDateInputValue();
  const selectedWeek = weekParam(selectedDate);
  const depositDate = dateInputValue(
    report.end < new Date() ? report.end : new Date()
  );
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-950">Financial Intelligence</h1><p className="mt-1 text-sm text-gray-600">GLV financial position and staff performance for {formatDate(report.start)} - {formatDate(report.end)}.</p></div>
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
              <span className="border-x px-3 py-2 text-xs font-medium text-gray-500">This Week</span>
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
          <Button asChild><Link href={exportHref} download><DownloadIcon className="size-4" />Export Weekly Report</Link></Button>
        </div>
      </div>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-gray-950">Business Overview</h2><p className="text-sm text-gray-600">Collections, capital exposure, salary commitments, and expected returns.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Collected" value={formatMoney(report.summary.totalCollected)} />
          <SummaryCard label="Recorded This Week" value={formatMoney(report.summary.weeklyRecordedCollections)} />
          <SummaryCard label="Deposited This Week" value={formatMoney(report.summary.weeklyDeposits)} />
          <SummaryCard
            label={
              report.summary.weeklyDepositVariance < 0
                ? "Weekly Deposit Shortage"
                : report.summary.weeklyDepositVariance > 0
                  ? "Weekly Deposit Surplus"
                  : "Weekly Deposit Variance"
            }
            value={formatMoney(Math.abs(report.summary.weeklyDepositVariance))}
            emphasis
          />
          <SummaryCard label="Outstanding Balance" value={formatMoney(report.summary.totalOutstandingBalance)} />
          <SummaryCard label="Expected Receivables" value={formatMoney(report.summary.totalExpectedReceivables)} />
          <SummaryCard label="Product Cost Exposure" value={formatMoney(report.summary.totalProductCost)} />
          <SummaryCard label="Current Month Payroll" value={formatMoney(report.summary.currentMonthPayroll)} />
          <SummaryCard label="Salary Paid for Due Month" value={formatMoney(report.summary.totalSalaryPaid)} />
          <SummaryCard label="Outstanding Salaries" value={formatMoney(report.summary.outstandingSalaries)} />
          <SummaryCard label="Payroll vs Income" value={formatMoney(report.summary.payrollVsIncome)} />
          <SummaryCard label="Payroll % of Revenue" value={`${report.summary.payrollPercentageOfRevenue.toFixed(1)}%`} />
          <SummaryCard label="Net Profit So Far" value={formatMoney(report.summary.netProfitSoFar)} />
          <SummaryCard label={report.summary.gainLossStatus} value={formatMoney(report.summary.projectedNetProfit)} emphasis />
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-gray-950">Analytics</h2><p className="text-sm text-gray-600">Collection trends, account health, and top performers at a glance.</p></div>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-950">Staff Weekly Performance</h2>
        <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1400px] text-sm"><thead><tr><th className="p-3">Rank</th><th className="p-3">Staff</th><th className="p-3">Customers</th><th className="p-3">Active</th><th className="p-3">Contract Value</th><th className="p-3">Weekly Recorded</th><th className="p-3">Weekly Deposited</th><th className="p-3">Deposit Variance</th><th className="p-3">Monthly Collection</th><th className="p-3">Total Collected</th><th className="p-3">Outstanding</th><th className="p-3">Due Month Salary</th><th className="p-3">Paid for Due Month</th><th className="p-3">Salary Balance</th><th className="p-3">Projected After Payroll</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.staffId} className="border-t"><td className="p-3"><Badge variant={row.rank === 1 ? "default" : "secondary"}>#{row.rank}</Badge></td><td className="p-3"><p className="font-semibold">{row.staffCode}</p><p className="text-xs text-gray-500">{row.staffName}</p></td><td className="p-3">{row.assignedCustomers}</td><td className="p-3">{row.activeAccounts}</td><td className="p-3">{formatMoney(row.totalContractValue)}</td><td className="p-3">{formatMoney(row.weeklyCollection)}</td><td className="p-3">{formatMoney(row.weeklyDeposited)}</td><td className={`p-3 font-semibold ${row.depositVariance < 0 ? "text-red-700" : row.depositVariance > 0 ? "text-blue-700" : "text-green-700"}`}>{row.depositVariance < 0 ? `Shortage ${formatMoney(Math.abs(row.depositVariance))}` : row.depositVariance > 0 ? `Surplus ${formatMoney(row.depositVariance)}` : "Balanced"}</td><td className="p-3">{formatMoney(row.monthlyCollection)}</td><td className="p-3">{formatMoney(row.totalCollected)}</td><td className="p-3">{formatMoney(row.outstandingBalance)}</td><td className="p-3">{formatMoney(row.monthlySalary)}</td><td className="p-3">{formatMoney(row.salaryPaidThisMonth)}</td><td className="p-3">{formatMoney(row.salaryBalanceThisMonth)}</td><td className="p-3">{formatMoney(row.projectedProfitAfterSalary)}</td></tr>)}</tbody></table></div>
      </section>

      <section id="staff-deposits" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Staff Deposits</h2>
          <p className="text-sm text-gray-600">
            Record money physically deposited into company accounts and compare
            it with payments entered for {formatDate(report.start)} - {formatDate(report.end)}.
          </p>
        </div>
        {query.depositError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{depositErrorMessage}</p> : null}
        {query.depositRecorded ? <p className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm text-lime-900">Staff deposit recorded.</p> : null}
        {query.depositDeleted ? <p className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm text-lime-900">Staff deposit deleted.</p> : null}
        {isAdminRole(session?.user?.role) ? (
          <form action={recordStaffDeposit} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 lg:grid-cols-7">
            <input type="hidden" name="week" value={selectedWeek} />
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Staff</span><select name="staffId" className="w-full rounded border p-3" required><option value="">Select staff</option>{report.rows.map((row) => <option key={row.staffId} value={row.staffId}>{row.staffCode} - {row.staffName}</option>)}</select></label>
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Amount Deposited</span><input name="amount" type="number" min="0.01" step="0.01" className="w-full rounded border p-3" required /></label>
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Deposit Date</span><input name="depositDate" type="date" defaultValue={depositDate} min={dateInputValue(report.start)} max={dateInputValue(report.end < new Date() ? report.end : new Date())} className="w-full rounded border p-3" required /></label>
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Channel</span><select name="channel" className="w-full rounded border p-3"><option value="Cash Deposit">Cash Deposit</option><option value="Bank Transfer">Bank Transfer</option><option value="Mobile Money">Mobile Money</option><option value="Cheque">Cheque</option><option value="Other">Other</option></select></label>
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Reference</span><input name="reference" className="w-full rounded border p-3" placeholder="Slip or transaction ID" /></label>
            <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Notes</span><input name="notes" className="w-full rounded border p-3" placeholder="Optional note" /></label>
            <div className="flex items-end"><Button type="submit" className="w-full">Record Deposit</Button></div>
          </form>
        ) : null}
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] text-sm">
              <thead><tr><th className="p-3">Deposit Date</th><th className="p-3">Staff</th><th className="p-3">Amount</th><th className="p-3">Channel</th><th className="p-3">Reference</th><th className="p-3">Recorded By</th><th className="p-3">Notes</th>{isAdminRole(session?.user?.role) ? <th className="p-3 text-right">Action</th> : null}</tr></thead>
              <tbody>{report.staffDeposits.map((deposit) => <tr key={deposit.id} className="border-t"><td className="p-3">{formatDate(deposit.depositDate)}</td><td className="p-3">{deposit.staff.code} - {deposit.staff.fullName}</td><td className="p-3 font-semibold">{formatMoney(deposit.amount)}</td><td className="p-3">{deposit.channel || "-"}</td><td className="p-3">{deposit.reference || "-"}</td><td className="p-3">{deposit.recordedByName}</td><td className="p-3">{deposit.notes || "-"}</td>{isAdminRole(session?.user?.role) ? <td className="p-3 text-right"><div className="flex justify-end"><ConfirmDeleteForm action={deleteStaffDeposit} id={deposit.id} title="Delete staff deposit?" description="This removes the deposit record and recalculates the staff variance." hiddenFields={{ week: selectedWeek }} triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125" /></ConfirmDeleteForm></div></td> : null}</tr>)}</tbody>
            </table>
          </div>
          {report.staffDeposits.length === 0 ? <p className="border-t p-6 text-center text-sm text-gray-500">No staff deposits recorded for this week.</p> : null}
        </div>
      </section>

      <section id="salary-tracking" className="space-y-4">
        <div><h2 className="text-lg font-semibold text-gray-950">Monthly Staff Salary Tracking</h2><p className="text-sm text-gray-600">Track monthly payroll by the salary month being settled, separate from the actual payment date.</p></div>
        {salaryError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{salaryErrorMessage}</p> : null}
        {query.salaryRecorded ? <p className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm text-lime-900">Salary payment recorded.</p> : null}
        <form action={recordStaffSalary} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 lg:grid-cols-6">
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Staff</span><select name="staffId" className="w-full rounded border p-3" required><option value="">Select staff</option>{report.rows.map((row) => <option key={row.staffId} value={row.staffId}>{row.staffCode} - {row.staffName}</option>)}</select></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Amount</span><input name="amount" type="number" min="0.01" step="0.01" className="w-full rounded border p-3" required /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Salary Month</span><input name="salaryMonth" type="month" defaultValue={defaultSalaryMonth} max={maxSalaryMonth} className="w-full rounded border p-3" required /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Payment Date</span><input name="paymentDate" type="date" defaultValue={today} max={today} className="w-full rounded border p-3" required /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Notes</span><input name="notes" className="w-full rounded border p-3" placeholder="Optional note" /></label>
          <div className="flex items-end"><Button type="submit" className="w-full">Record Salary</Button></div>
        </form>
        <div className="overflow-hidden rounded-lg border bg-white"><div className="overflow-x-auto"><table className="min-w-[920px] text-sm"><thead><tr><th className="p-3">Payment Date</th><th className="p-3">Salary Month</th><th className="p-3">Staff</th><th className="p-3">Amount</th><th className="p-3">Paid By</th><th className="p-3">Notes</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{report.salaryPayments.map((payment) => <tr key={payment.id} className="border-t"><td className="p-3">{formatDate(payment.paymentDate)}</td><td className="p-3">{formatMonth(payment.salaryMonth)}</td><td className="p-3">{payment.staff.code} - {payment.staff.fullName}</td><td className="p-3">{formatMoney(payment.amount)}</td><td className="p-3">{payment.paidByName}</td><td className="p-3">{payment.notes || "-"}</td><td className="p-3 text-right"><div className="flex justify-end"><ConfirmDeleteForm action={deleteStaffSalary} id={payment.id} title="Delete salary payment?" description="This removes a financial salary record and creates an audit entry." triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" /></ConfirmDeleteForm></div></td></tr>)}</tbody></table></div>{report.salaryPayments.length === 0 ? <p className="border-t p-6 text-center text-sm text-gray-500">No salary payments recorded.</p> : null}</div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">
            Product Profitability / Procurement
          </h2>
          <p className="text-sm text-gray-600">
            Layaway returns based on the number of customer accounts using each
            product.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Transport</th>
                <th className="p-3">Daily</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Layaway</th>
                <th className="p-3">Accounts</th>
                <th className="p-3">Layaway Profit</th>
                <th className="p-3">Expected Revenue</th>
                <th className="p-3">Expected Profit</th>
              </tr>
            </thead>
            <tbody>
              {report.products.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImagePreview
                        src={product.imageUrl}
                        alt={product.name}
                        className="size-10 bg-white"
                        previewTitle={product.name}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {product.category}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{formatMoney(product.costPrice)}</td>
                  <td className="p-3">{formatMoney(product.transportCost)}</td>
                  <td className="p-3">{formatMoney(product.dailyAmount)}</td>
                  <td className="p-3">{product.duration} days</td>
                  <td className="p-3">{formatMoney(product.layawayPrice)}</td>
                  <td className="p-3">{product.accountCount}</td>
                  <td className="p-3">
                    {formatMoney(product.layawayProfit)} (
                    {product.layawayProfitPercentage.toFixed(1)}%)
                  </td>
                  <td className="p-3">
                    {formatMoney(product.expectedLayawayRevenue)}
                  </td>
                  <td className="p-3">
                    {formatMoney(product.expectedLayawayProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
