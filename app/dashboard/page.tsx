import { auth } from "@/lib/auth";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSignIcon,
  CircleCheckBigIcon,
  CircleDollarSignIcon,
  ClockAlertIcon,
  HandCoinsIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { ProductImage } from "@/components/product-image";
import { formatMoney } from "@/lib/accounts";
import { getAdminReportSummary, getStaffDashboardSummary } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";
import { fallbackSettings, getSettings } from "@/lib/settings";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function greetingFor(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function normalizeDashboardCards(value: string | null | undefined) {
  if (value === "compact" || value === "detailed") {
    return value;
  }

  return "standard";
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  mode = "standard",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  mode?: "compact" | "standard" | "detailed";
}) {
  const compact = mode === "compact";
  const detailed = mode === "detailed";

  return (
    <div
      className={`glv-metric-card rounded-lg border bg-white ${compact ? "p-3" : "p-5"}`}
      style={{ "--metric-accent": accent } as CSSProperties}
      data-card-mode={mode}
    >
      <div className={`flex items-start justify-between ${compact ? "gap-2" : "gap-4"}`}>
        <div>
          <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-gray-500`}>{label}</p>
          <p className={`${compact ? "mt-1 text-xl" : "mt-2 text-2xl"} font-semibold text-gray-950`}>{value}</p>
          {detailed ? (
            <p className="mt-3 text-xs text-gray-500">Updated from the latest operational records.</p>
          ) : null}
        </div>
        <span className={`${compact ? "size-8" : "size-10"} inline-flex items-center justify-center rounded-md bg-gray-100 text-gray-700`}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);
  const settings = await getSettings().catch(() => fallbackSettings);
  const dashboardCards = normalizeDashboardCards(settings.dashboardCards);
  const greeting = greetingFor();
  let report: Awaited<ReturnType<typeof getAdminReportSummary>> | null = null;
  let staffReport: Awaited<ReturnType<typeof getStaffDashboardSummary>> | null = null;
  let reportUnavailable = false;

  if (isAdmin) {
    try {
      report = await getAdminReportSummary();
    } catch (error) {
      reportUnavailable = true;
      console.error("DASHBOARD_LOAD_ERROR", error);
    }
  } else if (session?.user?.staffId) {
    try {
      staffReport = await getStaffDashboardSummary(session.user.staffId);
    } catch (error) {
      reportUnavailable = true;
      console.error("STAFF_DASHBOARD_LOAD_ERROR", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-sm font-medium text-green-700">Business Overview</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">GLV Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {greeting}, {session?.user?.name ?? "GLV User"}.
          </p>
        </div>

        {isAdmin ? (
          <Button asChild variant="outline">
            <Link href="/reports">View Reports</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/activity">View Activity</Link>
          </Button>
        )}
      </div>

      {report ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Customers"
              value={report.totalCustomers}
              icon={UserRoundIcon}
              accent={settings.primaryColor}
              mode={dashboardCards}
            />
            <MetricCard
              label="Total Staff"
              value={report.totalStaff}
              icon={UsersIcon}
              accent={settings.secondaryColor}
              mode={dashboardCards}
            />
            <MetricCard
              label="Active Accounts"
              value={report.activeAccounts}
              icon={WalletCardsIcon}
              accent="#3b8d62"
              mode={dashboardCards}
            />
            <MetricCard
              label="Completed Accounts"
              value={report.completedAccounts}
              icon={CircleCheckBigIcon}
              accent="#44a36f"
              mode={dashboardCards}
            />
            <MetricCard
              label="Overdue Accounts"
              value={report.overdueAccounts}
              icon={ClockAlertIcon}
              accent="#d18b35"
              mode={dashboardCards}
            />
            <MetricCard
              label="Open Credits / Refunds"
              value={formatMoney(report.openCreditAmount)}
              icon={CircleDollarSignIcon}
              accent="#c93636"
              mode={dashboardCards}
            />
            <MetricCard
              label="Payments Collected"
              value={formatMoney(report.totalPaymentsCollected)}
              icon={HandCoinsIcon}
              accent="#846ab3"
              mode={dashboardCards}
            />
            <MetricCard
              label="Expected Receivables"
              value={formatMoney(report.expectedReceivables)}
              icon={BadgeDollarSignIcon}
              accent="#317f9d"
              mode={dashboardCards}
            />
            <MetricCard
              label="Profit Estimate"
              value={formatMoney(report.profitEstimate)}
              icon={TrendingUpIcon}
              accent={settings.primaryColor}
              mode={dashboardCards}
            />
          </section>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Gain / Loss Summary</h2>
              <p className="text-sm text-gray-600">Current cash position and projected profitability after product costs and monthly payroll.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard mode={dashboardCards} label="Product Cost Exposure" value={formatMoney(report.totalProductCost)} icon={WalletCardsIcon} accent="#d18b35" />
              <MetricCard mode={dashboardCards} label="Total Expected Profit" value={formatMoney(report.totalExpectedProfit)} icon={TrendingUpIcon} accent={settings.primaryColor} />
              <MetricCard mode={dashboardCards} label="Salary Paid for Due Month" value={formatMoney(report.totalSalaryPaid)} icon={HandCoinsIcon} accent="#846ab3" />
              <MetricCard mode={dashboardCards} label="Current Month Payroll" value={formatMoney(report.currentMonthPayroll)} icon={UsersIcon} accent={settings.secondaryColor} />
              <MetricCard mode={dashboardCards} label="Outstanding Salaries" value={formatMoney(report.outstandingSalaries)} icon={UsersIcon} accent="#d18b35" />
              <MetricCard mode={dashboardCards} label="Payroll vs Income" value={formatMoney(report.payrollVsIncome)} icon={BadgeDollarSignIcon} accent={report.payrollVsIncome < 0 ? "#c93636" : "#3b8d62"} />
              <MetricCard mode={dashboardCards} label="Net Profit So Far" value={formatMoney(report.netProfitSoFar)} icon={BadgeDollarSignIcon} accent={report.netProfitSoFar < 0 ? "#c93636" : "#3b8d62"} />
              <MetricCard mode={dashboardCards} label="Projected Net Profit" value={formatMoney(report.projectedNetProfit)} icon={TrendingUpIcon} accent={report.projectedNetProfit < 0 ? "#c93636" : settings.primaryColor} />
              <MetricCard mode={dashboardCards} label="Current Position" value={report.currentPositionStatus} icon={ClockAlertIcon} accent={report.netProfitSoFar < 0 ? "#d18b35" : "#3b8d62"} />
              <MetricCard mode={dashboardCards} label="Projection" value={report.gainLossStatus} icon={CircleCheckBigIcon} accent={report.projectedNetProfit < 0 ? "#c93636" : settings.primaryColor} />
              <MetricCard mode={dashboardCards} label="Refund Items" value={report.openCreditCount} icon={CircleDollarSignIcon} accent="#c93636" />
              <MetricCard mode={dashboardCards} label="Closure Refunds" value={report.closureRefundCount} icon={ClockAlertIcon} accent="#d18b35" />
            </div>
          </section>
        </div>
      ) : reportUnavailable ? (
        <DatabaseUnavailable retryHref="/dashboard" />
      ) : staffReport ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard mode={dashboardCards} label="My Customers" value={staffReport.totalCustomers} icon={UserRoundIcon} accent={settings.primaryColor} />
            <MetricCard mode={dashboardCards} label="My Accounts" value={staffReport.totalAccounts} icon={WalletCardsIcon} accent={settings.secondaryColor} />
            <MetricCard mode={dashboardCards} label="Active Accounts" value={staffReport.activeAccounts} icon={CircleCheckBigIcon} accent="#3b8d62" />
            <MetricCard mode={dashboardCards} label="Payments Today" value={staffReport.paymentsRecordedToday} icon={HandCoinsIcon} accent="#846ab3" />
            <MetricCard mode={dashboardCards} label="Collected Today" value={formatMoney(staffReport.totalCollectedToday)} icon={BadgeDollarSignIcon} accent="#317f9d" />
            <MetricCard mode={dashboardCards} label="Collected This Week" value={formatMoney(staffReport.totalCollectedThisWeek)} icon={TrendingUpIcon} accent={settings.primaryColor} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">Account Tasks</h2>
                  <p className="text-sm text-gray-600">Assigned customer activity and account progress.</p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/payments/new">Record Payment</Link>
                </Button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-lime-50 p-4">
                  <p className="text-xs font-medium uppercase text-lime-900">Customers Added</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{staffReport.customersAddedThisWeek}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs font-medium uppercase text-gray-500">Completed</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{staffReport.completedAccounts}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="text-xs font-medium uppercase text-amber-800">Needs Attention</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{staffReport.overdueAccounts + staffReport.suspendedAccounts}</p>
                </div>
                <div className="rounded-lg bg-sky-50 p-4">
                  <p className="text-xs font-medium uppercase text-sky-800">Opened This Week</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{staffReport.accountsOpenedThisWeek}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-950">Recent Customers</h2>
              <div className="mt-4 space-y-3">
                {staffReport.recentCustomers.map((customer) => (
                  <Link key={customer.id} href={`/customers/${customer.id}`} className="block rounded-lg border border-gray-100 p-3 transition hover:border-lime-300 hover:bg-lime-50/40">
                    <p className="font-semibold text-gray-950">{customer.fullName}</p>
                    <p className="text-xs text-gray-500">{customer.customerId} • {customer.accounts.length} account(s)</p>
                  </Link>
                ))}
                {staffReport.recentCustomers.length === 0 ? (
                  <p className="text-sm text-gray-600">No assigned customers yet.</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">Recent Payments</h2>
                <p className="text-sm text-gray-600">Payment records for assigned customers.</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/payments">View Payments</Link>
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Method</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {staffReport.recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b last:border-0">
                      <td className="p-3 font-mono text-xs">{payment.receiptNo}</td>
                      <td className="p-3">{formatDate(payment.paymentDate)}</td>
                      <td className="p-3">{payment.account.customer.fullName}</td>
                      <td className="p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <ProductImage
                            src={payment.account.product.imageUrl}
                            alt={payment.account.product.name}
                            className="size-9 bg-white"
                          />
                          <span className="truncate">
                            {payment.account.product.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">{payment.method}</td>
                      <td className="p-3 text-right font-semibold">{formatMoney(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {staffReport.recentPayments.length === 0 ? (
                <p className="border-t py-8 text-center text-sm text-gray-600">
                  No payment activity yet.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="glv-metric-card rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-950">
            Staff Workspace
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Use Customers, Accounts, and Payments to manage your assigned GLV
            customers.
          </p>
        </div>
      )}
    </div>
  );
}
