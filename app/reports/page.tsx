import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, getEffectiveAccountStatus } from "@/lib/accounts";
import { getAdminReportSummary } from "@/lib/reports";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "money" | "warning";
}) {
  const valueClass =
    tone === "warning"
      ? "text-red-700"
      : tone === "money"
        ? "text-green-700"
        : "text-gray-950";

  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

export default async function ReportsPage() {
  const report = await getAdminReportSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Company-wide GLV operating summary.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Customers" value={report.totalCustomers} />
        <MetricCard label="Total Staff" value={report.totalStaff} />
        <MetricCard label="Total Accounts" value={report.totalAccounts} />
        <MetricCard
          label="Overdue Accounts"
          value={report.overdueAccounts}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Accounts" value={report.activeAccounts} />
        <MetricCard label="Completed Accounts" value={report.completedAccounts} />
        <MetricCard label="Cancelled Accounts" value={report.cancelledAccounts} />
        <MetricCard label="Suspended Accounts" value={report.suspendedAccounts} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Payments Collected"
          value={formatMoney(report.totalPaymentsCollected)}
          tone="money"
        />
        <MetricCard
          label="Expected Receivables"
          value={formatMoney(report.expectedReceivables)}
          tone="money"
        />
        <MetricCard
          label="Outstanding Balance"
          value={formatMoney(report.totalOutstandingBalance)}
          tone="money"
        />
        <MetricCard
          label="Profit Estimate"
          value={formatMoney(report.profitEstimate)}
          tone="money"
        />
      </section>

      <section className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-950">
              Recent Accounts
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Latest installment accounts opened.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/accounts">View Accounts</Link>
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Target</th>
              <th className="p-3 font-medium">Balance</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {report.recentAccounts.map((account) => {
              const status = getEffectiveAccountStatus(account);

              return (
                <tr key={account.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium text-gray-950">
                      {account.customer.fullName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {account.customer.customerId}
                    </div>
                  </td>
                  <td className="p-3">{account.product.name}</td>
                  <td className="p-3">{account.customer.staff.code}</td>
                  <td className="p-3">{formatMoney(account.targetAmount)}</td>
                  <td className="p-3">{formatMoney(account.balance)}</td>
                  <td className="p-3">
                    <Badge variant={status === "OVERDUE" ? "destructive" : "default"}>
                      {status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/accounts/${account.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {report.recentAccounts.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No accounts found.
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-950">
              Recent Payments
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Latest payments recorded across GLV.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/payments">View Payments</Link>
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Receipt</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {report.recentPayments.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {payment.receiptNo}
                </td>
                <td className="p-3">{formatDate(payment.paymentDate)}</td>
                <td className="p-3">{payment.account.customer.fullName}</td>
                <td className="p-3">{payment.account.product.name}</td>
                <td className="p-3">{formatMoney(payment.amount)}</td>
                <td className="p-3">{payment.method}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {report.recentPayments.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No payments recorded yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
