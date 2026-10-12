"use client";

import { ChartCard, DotPlotChart, DonutChart, TrendChart, formatCompact } from "@/components/reports/chart-primitives";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--chart-good)", OVERDUE: "var(--chart-critical)", PROBATION: "var(--chart-warning)",
  COMPLETED: "var(--chart-blue)", SUSPENDED: "var(--chart-serious)", DORMANT: "var(--chart-muted)",
  CLOSED: "var(--chart-muted)", ARCHIVED: "var(--chart-muted)", CANCELLED: "var(--chart-muted)",
};

export function ActivityAnalyticsCharts({
  weeklyPayments, accountStatus, staffPerformance, isAdmin,
}: {
  weeklyPayments: { label: string; amount: number; count: number }[];
  accountStatus: { status: string; count: number }[];
  staffPerformance: { staffCode: string; staffName: string; collected: number | null; customers: number; accounts: number }[];
  isAdmin: boolean;
}) {
  const trend = weeklyPayments.map((item) => ({ label: item.label.slice(0, 3), collected: isAdmin ? item.amount : item.count, isSelected: false }));
  const statuses = accountStatus.filter((item) => item.count > 0).map((item) => ({
    key: item.status, label: item.status.toLowerCase().replace(/(^|_)\w/g, (s) => s.toUpperCase()), value: item.count, color: STATUS_COLORS[item.status] ?? "var(--chart-muted)",
  }));
  const performance = staffPerformance.slice(0, 8).map((item) => ({
    key: item.staffCode, label: `${item.staffCode} · ${item.staffName}`,
    value: isAdmin ? item.collected ?? 0 : item.accounts,
    color: isAdmin ? "var(--chart-blue)" : "var(--chart-good)",
  }));

  return <div className="grid gap-4 lg:grid-cols-2">
    <ChartCard title={isAdmin ? "Weekly collections" : "Payments this week"} description={isAdmin ? "Customer payment value by day." : "Recorded payment count by day."}>
      <TrendChart points={trend} valueFormat={isAdmin ? "money" : "number"} seriesLabel={isAdmin ? "Customer collections" : "Payments recorded"} />
    </ChartCard>
    <ChartCard title="Account status" description="Current installment accounts grouped by lifecycle status.">
      <DonutChart items={statuses} centerLabel="Accounts" emptyMessage="No accounts to display." />
    </ChartCard>
    <ChartCard title={isAdmin ? "Staff collections" : "My account workload"} description={isAdmin ? "Weekly collection value by staff member." : "Accounts assigned to your staff profile."}>
      <DotPlotChart items={performance} formatValue={isAdmin ? formatCompact : (value) => value.toLocaleString()} emptyMessage="No activity to display." />
    </ChartCard>
  </div>;
}
