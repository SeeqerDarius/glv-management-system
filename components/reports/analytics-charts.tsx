"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/accounts";

type TrendPoint = { label: string; collected: number; isSelected: boolean };
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

function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}GHS ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}GHS ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}GHS ${Math.round(abs)}`;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function truncateLabel(label: string, max: number) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glv-chart rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Tooltip({
  x,
  y,
  width,
  lines,
  align = "center",
}: {
  x: number;
  y: number;
  width: number;
  lines: { label: string; value: string; color?: string }[];
  align?: "center" | "left" | "right";
}) {
  const charWidth = 6.4;
  const maxChars = Math.max(...lines.flatMap((line) => [line.label.length, line.value.length]), 8);
  const boxWidth = Math.min(220, Math.max(110, maxChars * charWidth + 24));
  const rowHeight = 34;
  const boxHeight = 12 + lines.length * rowHeight;
  let boxX = align === "left" ? x : align === "right" ? x - boxWidth : x - boxWidth / 2;
  boxX = Math.max(4, Math.min(boxX, width - boxWidth - 4));
  const boxY = Math.max(4, y - boxHeight - 10);

  return (
    <g pointerEvents="none">
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={6}
        fill="var(--chart-tooltip-bg)"
        opacity={0.95}
      />
      {lines.map((line, index) => {
        const rowTop = boxY + 6 + index * rowHeight;
        return (
          <g key={line.label}>
            {line.color ? (
              <line
                x1={boxX + 10}
                y1={rowTop + 9}
                x2={boxX + 22}
                y2={rowTop + 9}
                stroke={line.color}
                strokeWidth={2}
              />
            ) : null}
            <text
              x={boxX + (line.color ? 28 : 10)}
              y={rowTop + 13}
              fontSize={9.5}
              fill="var(--chart-tooltip-text)"
              opacity={0.7}
            >
              {line.label}
            </text>
            <text x={boxX + 10} y={rowTop + 29} fontSize={13} fontWeight={700} fill="var(--chart-tooltip-text)">
              {line.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  if (points.length === 0) return <EmptyState message="No collection history yet." />;

  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = niceMax(Math.max(...points.map((point) => point.collected), 1) * 1.15);
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xAt = (index: number) => padding.left + index * xStep;
  const yAt = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index)},${yAt(point.collected)}`)
    .join(" ");
  const areaPath = `${linePath} L${xAt(points.length - 1)},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Weekly collections trend">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.16} />
          <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridLines.map((fraction) => {
        const y = padding.top + plotHeight - fraction * plotHeight;
        return (
          <g key={fraction}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padding.left - 8} y={y + 3} fontSize={9} textAnchor="end" fill="var(--chart-muted)">
              {formatCompact(maxValue * fraction)}
            </text>
          </g>
        );
      })}
      <line
        x1={padding.left}
        y1={padding.top + plotHeight}
        x2={width - padding.right}
        y2={padding.top + plotHeight}
        stroke="var(--chart-baseline)"
        strokeWidth={1}
      />
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke="var(--chart-blue)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => (
        <text
          key={`label-${point.label}`}
          x={xAt(index)}
          y={height - 6}
          fontSize={9}
          textAnchor="middle"
          fill="var(--chart-muted)"
        >
          {point.label}
        </text>
      ))}
      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={xAt(index)}
            cy={yAt(point.collected)}
            r={point.isSelected ? 6 : 4}
            fill="var(--chart-blue)"
            stroke="#fcfcfb"
            strokeWidth={2}
          />
          <rect
            x={xAt(index) - xStep / 2}
            y={padding.top}
            width={xStep || plotWidth}
            height={plotHeight}
            fill="transparent"
            tabIndex={0}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            aria-label={`${point.label}: ${formatMoney(point.collected)}`}
          />
        </g>
      ))}
      {hovered !== null ? (
        <Tooltip
          x={xAt(hovered)}
          y={yAt(points[hovered].collected)}
          width={width}
          lines={[
            {
              label: points[hovered].isSelected ? `${points[hovered].label} (selected)` : points[hovered].label,
              value: formatMoney(points[hovered].collected),
              color: "var(--chart-blue)",
            },
          ]}
        />
      ) : null}
    </svg>
  );
}

function HorizontalBarChart({
  items,
  formatValue,
  emptyMessage,
}: {
  items: { key: string; label: string; value: number; color: string }[];
  formatValue: (value: number) => string;
  emptyMessage: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  const width = 600;
  const rowHeight = 34;
  const barHeight = 18;
  const padding = { top: 8, right: 76, bottom: 8, left: 116 };
  const plotWidth = width - padding.left - padding.right;
  const height = padding.top + padding.bottom + items.length * rowHeight;
  const maxValue = niceMax(Math.max(...items.map((item) => Math.max(item.value, 0)), 1));
  const xScale = (value: number) => (Math.max(value, 0) / maxValue) * plotWidth;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Comparison bar chart">
      {items.map((item, index) => {
        const y = padding.top + index * rowHeight;
        const barWidth = xScale(item.value);
        const isHovered = hovered === index;
        return (
          <g key={item.key}>
            <text
              x={padding.left - 10}
              y={y + barHeight / 2 + 4}
              fontSize={10}
              textAnchor="end"
              fill="var(--chart-ink-secondary)"
            >
              {truncateLabel(item.label, 16)}
            </text>
            <rect
              x={padding.left}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={item.color}
              opacity={isHovered ? 1 : 0.9}
            />
            <text
              x={padding.left + barWidth + 8}
              y={y + barHeight / 2 + 4}
              fontSize={10}
              fontWeight={600}
              fill="var(--chart-ink)"
            >
              {formatValue(item.value)}
            </text>
            <rect
              x={padding.left}
              y={y - 2}
              width={plotWidth + padding.right}
              height={rowHeight}
              fill="transparent"
              tabIndex={0}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              aria-label={`${item.label}: ${formatValue(item.value)}`}
            />
          </g>
        );
      })}
      {hovered !== null ? (
        <Tooltip
          x={padding.left + xScale(items[hovered].value) / 2}
          y={padding.top + hovered * rowHeight}
          width={width}
          lines={[{ label: items[hovered].label, value: formatValue(items[hovered].value), color: items[hovered].color }]}
        />
      ) : null}
    </svg>
  );
}

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
