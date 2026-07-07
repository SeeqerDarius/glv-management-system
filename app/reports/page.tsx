import Link from "next/link";
import { DownloadIcon, Trash2 } from "lucide-react";
import { recordStaffSalary, deleteStaffSalary } from "@/actions/salaries";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { todayDateInputValue } from "@/lib/date-rules";
import { getWeeklyStaffPerformanceReport } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
  const isAdmin = isAdminRole(session?.user?.role);
  const query = await searchParams;
  let report: Awaited<ReturnType<typeof getWeeklyStaffPerformanceReport>>;

  if (!isAdmin) {
    return (
      <div className="rounded-lg border bg-white p-5">
        <h1 className="text-xl font-semibold text-gray-950">
          Reports are available to administrators.
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

  try {
    report = await getWeeklyStaffPerformanceReport();
  } catch (error) {
    console.error("REPORTS_LOAD_ERROR", error);
    return <DatabaseUnavailable retryHref="/reports" title="Reports are temporarily unavailable" />;
  }

  const today = todayDateInputValue();
  const salaryError = query.salaryError;
  const salaryErrorMessage =
    salaryError === "future-date"
      ? "Salary payment date cannot be in the future."
      : "Unable to record salary payment. Check the staff, amount, and date.";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-950">Financial Intelligence</h1><p className="mt-1 text-sm text-gray-600">GLV financial position and staff performance for {formatDate(report.start)} - {formatDate(report.end)}.</p></div>
        <Button asChild><Link href="/api/reports/weekly-export" download><DownloadIcon className="size-4" />Export Weekly Report</Link></Button>
      </div>

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold text-gray-950">Business Overview</h2><p className="text-sm text-gray-600">Collections, capital exposure, salary commitments, and expected returns.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Collected" value={formatMoney(report.summary.totalCollected)} />
          <SummaryCard label="Outstanding Balance" value={formatMoney(report.summary.totalOutstandingBalance)} />
          <SummaryCard label="Expected Receivables" value={formatMoney(report.summary.totalExpectedReceivables)} />
          <SummaryCard label="Product Cost Exposure" value={formatMoney(report.summary.totalProductCost)} />
          <SummaryCard label="Current Month Payroll" value={formatMoney(report.summary.currentMonthPayroll)} />
          <SummaryCard label="Salary Paid This Month" value={formatMoney(report.summary.totalSalaryPaid)} />
          <SummaryCard label="Outstanding Salaries" value={formatMoney(report.summary.outstandingSalaries)} />
          <SummaryCard label="Payroll vs Income" value={formatMoney(report.summary.payrollVsIncome)} />
          <SummaryCard label="Payroll % of Revenue" value={`${report.summary.payrollPercentageOfRevenue.toFixed(1)}%`} />
          <SummaryCard label="Net Profit So Far" value={formatMoney(report.summary.netProfitSoFar)} />
          <SummaryCard label={report.summary.gainLossStatus} value={formatMoney(report.summary.projectedNetProfit)} emphasis />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-950">Staff Weekly Performance</h2>
        <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full min-w-[1200px] text-sm"><thead><tr><th className="p-3">Rank</th><th className="p-3">Staff</th><th className="p-3">Customers</th><th className="p-3">Active</th><th className="p-3">Contract Value</th><th className="p-3">Weekly</th><th className="p-3">Monthly Collection</th><th className="p-3">Total Collected</th><th className="p-3">Outstanding</th><th className="p-3">Monthly Salary</th><th className="p-3">Paid This Month</th><th className="p-3">Salary Balance</th><th className="p-3">Projected After Payroll</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.staffId} className="border-t"><td className="p-3"><Badge variant={row.rank === 1 ? "default" : "secondary"}>#{row.rank}</Badge></td><td className="p-3"><p className="font-semibold">{row.staffCode}</p><p className="text-xs text-gray-500">{row.staffName}</p></td><td className="p-3">{row.assignedCustomers}</td><td className="p-3">{row.activeAccounts}</td><td className="p-3">{formatMoney(row.totalContractValue)}</td><td className="p-3">{formatMoney(row.weeklyCollection)}</td><td className="p-3">{formatMoney(row.monthlyCollection)}</td><td className="p-3">{formatMoney(row.totalCollected)}</td><td className="p-3">{formatMoney(row.outstandingBalance)}</td><td className="p-3">{formatMoney(row.monthlySalary)}</td><td className="p-3">{formatMoney(row.salaryPaidThisMonth)}</td><td className="p-3">{formatMoney(row.salaryBalanceThisMonth)}</td><td className="p-3">{formatMoney(row.projectedProfitAfterSalary)}</td></tr>)}</tbody></table></div>
      </section>

      <section id="salary-tracking" className="space-y-4">
        <div><h2 className="text-lg font-semibold text-gray-950">Monthly Staff Salary Tracking</h2><p className="text-sm text-gray-600">Track monthly payroll, payments made this month, and remaining salary balances.</p></div>
        {salaryError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{salaryErrorMessage}</p> : null}
        {query.salaryRecorded ? <p className="rounded-md border border-lime-200 bg-lime-50 p-3 text-sm text-lime-900">Salary payment recorded.</p> : null}
        <form action={recordStaffSalary} className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Staff</span><select name="staffId" className="w-full rounded border p-3" required><option value="">Select staff</option>{report.rows.map((row) => <option key={row.staffId} value={row.staffId}>{row.staffCode} - {row.staffName}</option>)}</select></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Amount</span><input name="amount" type="number" min="0.01" step="0.01" className="w-full rounded border p-3" required /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Payment Date</span><input name="paymentDate" type="date" defaultValue={today} max={today} className="w-full rounded border p-3" required /></label>
          <label className="space-y-1"><span className="text-xs font-medium text-gray-600">Notes</span><input name="notes" className="w-full rounded border p-3" placeholder="Optional note" /></label>
          <div className="flex items-end"><Button type="submit" className="w-full">Record Salary</Button></div>
        </form>
        <div className="overflow-hidden rounded-lg border bg-white"><div className="overflow-x-auto"><table className="min-w-[820px] text-sm"><thead><tr><th className="p-3">Date</th><th className="p-3">Staff</th><th className="p-3">Amount</th><th className="p-3">Paid By</th><th className="p-3">Notes</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{report.salaryPayments.map((payment) => <tr key={payment.id} className="border-t"><td className="p-3">{formatDate(payment.paymentDate)}</td><td className="p-3">{payment.staff.code} - {payment.staff.fullName}</td><td className="p-3">{formatMoney(payment.amount)}</td><td className="p-3">{payment.paidByName}</td><td className="p-3">{payment.notes || "-"}</td><td className="p-3 text-right"><div className="flex justify-end"><ConfirmDeleteForm action={deleteStaffSalary} id={payment.id} title="Delete salary payment?" description="This removes a financial salary record and creates an audit entry." triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" /></ConfirmDeleteForm></div></td></tr>)}</tbody></table></div>{report.salaryPayments.length === 0 ? <p className="border-t p-6 text-center text-sm text-gray-500">No salary payments recorded.</p> : null}</div>
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
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
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
