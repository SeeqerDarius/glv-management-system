"use client";

import {
  ChartCard,
  HorizontalBarChart,
  TrendChart,
  formatCompact,
  type TrendPoint,
} from "@/components/reports/chart-primitives";

type StatusItem = { status: string; count: number };
type RankedItem = { code?: string; name: string; value: number };

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "var(--chart-good)" },
  OVERDUE: { label: "Overdue", color: "var(--chart-critical)" },
  PROBATION: { label: "Probation", color: "var(--chart-warning)" },
  COMPLETED: { label: "Completed", color: "var(--chart-blue)" },
  SUSPENDED: { label: "Suspended", color: "var(--chart-serious)" },
  DORMANT: { label: "Dormant", color: "var(--chart-muted)" },
  CLOSED: { label: "Closed", color: "var(--chart-muted)" },
  ARCHIVED: { label: "Archived", color: "var(--chart-muted)" },
  CANCELLED: { label: "Cancelled", color: "var(--chart-muted)" },
};

export function ReportAnalyticsCharts({
  trend,
  accountStatus,
  staffPerformance,
  productProfitability,
}: {
  trend: TrendPoint[];
  accountStatus: StatusItem[];
  staffPerformance: RankedItem[];
  productProfitability: RankedItem[];
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

  const staffItems = staffPerformance
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((item) => ({
      key: item.code ?? item.name,
      label: item.code ?? item.name,
      value: item.value,
      color: "var(--chart-blue)",
    }));

  const productItems = productProfitability
    .filter((item) => item.value !== 0)
    .slice(0, 8)
    .map((item) => ({
      key: item.name,
      label: item.name,
      value: item.value,
      color: "var(--chart-green)",
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Weekly Collections Trend"
        description={`Total collected per week, last ${trend.length} weeks (selected week highlighted).`}
      >
        <TrendChart points={trend} />
      </ChartCard>
      <ChartCard title="Account Status Breakdown" description="Customer accounts grouped by current status.">
        <HorizontalBarChart items={statusItems} formatValue={(value) => value.toLocaleString()} emptyMessage="No accounts yet." />
      </ChartCard>
      <ChartCard title="Staff Performance" description="Weekly collection by staff member, top 8.">
        <HorizontalBarChart items={staffItems} formatValue={formatCompact} emptyMessage="No staff collections this week." />
      </ChartCard>
      <ChartCard title="Product Profitability" description="Expected layaway profit by product, top 8.">
        <HorizontalBarChart items={productItems} formatValue={formatCompact} emptyMessage="No product data yet." />
      </ChartCard>
    </div>
  );
}

export { STATUS_META };
