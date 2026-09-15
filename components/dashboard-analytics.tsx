"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ChartCard,
  HorizontalBarChart,
  TrendBadge,
  TrendChart,
  type TrendPoint,
} from "@/components/reports/chart-primitives";
import { AnimatedMeter } from "@/components/reports/meter-gauge";
import { STATUS_META } from "@/components/reports/analytics-charts";
import { formatMoney } from "@/lib/accounts";

type StatusItem = { status: string; count: number };

/**
 * KPI card for figures with a real previous-period value to compare
 * against. The meter animates from that previous position to the current
 * one on mount, so growth visibly advances and decline visibly pulls back,
 * instead of the figure only ever appearing as a static number.
 *
 * `icon` takes an already-rendered element (e.g. `<UserRoundIcon />`), not
 * a component reference, and `formatAs` is a flag rather than a formatter
 * function: this is a client component, so a function or component-type
 * prop coming from the Server Component dashboard page can't cross that
 * boundary (React can only serialize already-rendered elements and plain
 * data across it, not function values).
 */
export function GaugeMetricCard({
  label,
  value,
  previousValue,
  formatAs = "number",
  icon,
  accent,
  suffix = "vs last week",
}: {
  label: string;
  value: number;
  previousValue: number;
  formatAs?: "number" | "money";
  icon: ReactNode;
  accent: string;
  suffix?: string;
}) {
  const displayValue = formatAs === "money" ? formatMoney(value) : value.toLocaleString();

  return (
    <div
      className="glv-metric-card glv-chart rounded-lg border bg-white p-5"
      style={{ "--metric-accent": accent } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="inline-flex size-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
          {icon}
        </span>
      </div>
      <div className="mt-1 flex flex-col items-center">
        <AnimatedMeter value={value} previousValue={previousValue} accent={accent} size={140} />
        <p className="-mt-2 text-2xl font-semibold text-gray-950">{displayValue}</p>
        <div className="mt-1.5">
          <TrendBadge current={value} previous={previousValue} suffix={suffix} />
        </div>
      </div>
    </div>
  );
}

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
