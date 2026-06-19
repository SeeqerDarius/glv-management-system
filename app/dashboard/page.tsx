import { auth } from "@/lib/auth";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSignIcon,
  CircleCheckBigIcon,
  ClockAlertIcon,
  HandCoinsIcon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { formatMoney } from "@/lib/accounts";
import { getAdminReportSummary } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div
      className="glv-metric-card rounded-lg border bg-white p-5"
      style={{ "--metric-accent": accent } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);
  let report: Awaited<ReturnType<typeof getAdminReportSummary>> | null = null;
  let reportUnavailable = false;

  if (isAdmin) {
    try {
      report = await getAdminReportSummary();
    } catch {
      reportUnavailable = true;
      console.warn("Dashboard data is temporarily unavailable.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-sm font-medium text-green-700">Business Overview</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">GLV Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome back, {session?.user?.name}.
          </p>
        </div>

        {isAdmin ? (
          <Button asChild variant="outline">
            <Link href="/reports">View Reports</Link>
          </Button>
        ) : null}
      </div>

      {report ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Customers"
              value={report.totalCustomers}
              icon={UserRoundIcon}
              accent="#7ac943"
            />
            <MetricCard
              label="Total Staff"
              value={report.totalStaff}
              icon={UsersIcon}
              accent="#2f8fb5"
            />
            <MetricCard
              label="Active Accounts"
              value={report.activeAccounts}
              icon={WalletCardsIcon}
              accent="#3b8d62"
            />
            <MetricCard
              label="Completed Accounts"
              value={report.completedAccounts}
              icon={CircleCheckBigIcon}
              accent="#44a36f"
            />
            <MetricCard
              label="Overdue Accounts"
              value={report.overdueAccounts}
              icon={ClockAlertIcon}
              accent="#d18b35"
            />
            <MetricCard
              label="Payments Collected"
              value={formatMoney(report.totalPaymentsCollected)}
              icon={HandCoinsIcon}
              accent="#846ab3"
            />
            <MetricCard
              label="Expected Receivables"
              value={formatMoney(report.expectedReceivables)}
              icon={BadgeDollarSignIcon}
              accent="#317f9d"
            />
            <MetricCard
              label="Profit Estimate"
              value={formatMoney(report.profitEstimate)}
              icon={TrendingUpIcon}
              accent="#7ac943"
            />
        </section>
      ) : reportUnavailable ? (
        <DatabaseUnavailable retryHref="/dashboard" />
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
