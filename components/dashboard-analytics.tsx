"use client";

import {
  ChartCard,
  HorizontalBarChart,
  TrendChart,
  type TrendPoint,
} from "@/components/reports/chart-primitives";
import { STATUS_META } from "@/components/reports/analytics-charts";

type StatusItem = { status: string; count: number };

export function AdminDashboardCharts({
  trend,
  accountStatus,
}: {
  trend: TrendPoint[];
  accountStatus: StatusItem[];
}) {
  const statusItems = accountStatus
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      key: item.status,
      label: STATUS_META[item.status]?.label ?? item.status,
      value: item.count,
      color: STATUS_META[item.status]?.color ?? "var(--chart-muted)",
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <ChartCard
        title="Weekly Collections Trend"
        description={`Total collected per week, last ${trend.length} weeks (current week highlighted).`}
      >
        <TrendChart points={trend} />
      </ChartCard>
      <ChartCard title="Account Status Breakdown" description="Customer accounts grouped by current status.">
        <HorizontalBarChart
          items={statusItems}
          formatValue={(value) => value.toLocaleString()}
          emptyMessage="No accounts yet."
        />
      </ChartCard>
    </div>
  );
}

export function StaffDashboardTrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <ChartCard
      title="My Weekly Collections"
      description={`Total collected per week for your assigned customers, last ${trend.length} weeks.`}
    >
      <TrendChart points={trend} />
    </ChartCard>
  );
}
