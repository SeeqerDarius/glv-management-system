import { auth } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/accounts";
import { getAdminReportSummary } from "@/lib/reports";

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const report = isAdmin ? await getAdminReportSummary() : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">GLV Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Welcome {session?.user?.name}. Role: {session?.user?.role}
          </p>
        </div>

        {isAdmin ? (
          <Button asChild variant="outline">
            <Link href="/reports">View Reports</Link>
          </Button>
        ) : null}
      </div>

      {report ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Customers" value={report.totalCustomers} />
            <MetricCard label="Total Staff" value={report.totalStaff} />
            <MetricCard label="Active Accounts" value={report.activeAccounts} />
            <MetricCard label="Overdue Accounts" value={report.overdueAccounts} />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Payments Collected"
              value={formatMoney(report.totalPaymentsCollected)}
            />
            <MetricCard
              label="Expected Receivables"
              value={formatMoney(report.expectedReceivables)}
            />
            <MetricCard
              label="Profit Estimate"
              value={formatMoney(report.profitEstimate)}
            />
          </section>
        </>
      ) : (
        <div className="rounded-lg border bg-white p-5">
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
