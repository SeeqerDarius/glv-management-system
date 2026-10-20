"use client";

import { ChartCard, DotPlotChart, DonutChart, MultiTrendChart, TrendChart, formatCompact } from "@/components/reports/chart-primitives";

const STAFF_LINE_COLORS = [
  "var(--chart-blue)",
  "var(--chart-good)",
  "var(--chart-warning)",
  "var(--chart-critical)",
  "var(--chart-serious)",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#475569",
  "#c2410c",
  "#0f766e",
];

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
  staffPerformance: { staffId: string; staffCode: string; staffName: string; collected: number | null; weeklyCollectionsByDay: (number | null)[]; customers: number; accounts: number }[];
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
  const collectionSeries = staffPerformance
    .filter(() => isAdmin)
    .map((member, index) => ({
      key: member.staffId,
      label: `${member.staffCode} · ${member.staffName}`,
      color: STAFF_LINE_COLORS[index % STAFF_LINE_COLORS.length],
    }));
  const collectionPoints = weeklyPayments.map((item, dayIndex) => ({
    label: item.label.slice(0, 3),
    isSelected: false,
    values: Object.fromEntries(
      collectionSeries.map((series) => [
        series.key,
        staffPerformance.find((member) => member.staffId === series.key)
          ?.weeklyCollectionsByDay[dayIndex] ?? 0,
      ])
    ),
  }));
  const hasWeeklyCollections = collectionSeries.some((series) =>
    staffPerformance
      .find((member) => member.staffId === series.key)
      ?.weeklyCollectionsByDay.some((amount) => (amount ?? 0) > 0)
  );

  return <div className="grid gap-4 lg:grid-cols-2">
    <ChartCard title={isAdmin ? "Weekly collections" : "Payments this week"} description={isAdmin ? "Daily customer collections, with a separate line for each staff member." : "Recorded payment count by day."}>
      {isAdmin ? (
        collectionSeries.length > 0 && hasWeeklyCollections ? (
          <MultiTrendChart points={collectionPoints} series={collectionSeries} valueFormat="money" />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            No customer collections recorded this week.
          </div>
        )
      ) : (
        <TrendChart points={trend} valueFormat="number" seriesLabel="Payments recorded" />
      )}
    </ChartCard>
    <ChartCard title="Account status" description="Current installment accounts grouped by lifecycle status.">
      <DonutChart items={statuses} centerLabel="Accounts" emptyMessage="No accounts to display." />
    </ChartCard>
    <ChartCard title={isAdmin ? "Staff collections" : "My account workload"} description={isAdmin ? "Weekly collection value by staff member." : "Accounts assigned to your staff profile."}>
      <DotPlotChart items={performance} formatValue={isAdmin ? formatCompact : (value) => value.toLocaleString()} emptyMessage="No activity to display." />
    </ChartCard>
  </div>;
}
