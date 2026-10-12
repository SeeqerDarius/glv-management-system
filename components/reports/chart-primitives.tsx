"use client";

import { useId, useState } from "react";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { formatMoney } from "@/lib/accounts";

export type TrendPoint = { label: string; collected: number; isSelected: boolean };
export type ComparisonTrendPoint = TrendPoint & { deposited: number };
export type MultiTrendPoint = { label: string; values: Record<string, number>; isSelected?: boolean };
export type ChartSeries = { key: string; label: string; color: string; dash?: string };

export function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}GHS ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}GHS ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}GHS ${Math.round(abs)}`;
}

export function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

export function truncateLabel(label: string, max: number) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-gray-500">
      {message}
    </div>
  );
}

export function ChartCard({
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

export function Tooltip({
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

function curvedPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    const previous = points[index - 1];
    const control = (point.x - previous.x) / 3;
    return `${path} C${previous.x + control},${previous.y} ${point.x - control},${point.y} ${point.x},${point.y}`;
  }, "");
}

function TrendLineChart({
  points,
  series,
  valueFormat,
}: {
  points: MultiTrendPoint[];
  series: ChartSeries[];
  valueFormat: "money" | "number";
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  if (points.length === 0) return <EmptyState message="No history is available for this period." />;

  const width = 600;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 34, left: 62 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = niceMax(Math.max(...points.flatMap((point) => series.map((item) => point.values[item.key] ?? 0)), 1) * 1.1);
  const xStep = plotWidth / Math.max(points.length - 1, 1);
  const xAt = (index: number) => points.length === 1 ? padding.left + plotWidth / 2 : padding.left + index * xStep;
  const yAt = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const formatAxisValue = (value: number) => valueFormat === "money" ? formatCompact(value) : Math.round(value).toLocaleString();
  const formatTooltipValue = (value: number) => valueFormat === "money" ? formatMoney(value) : Math.round(value).toLocaleString();
  const coordinates = (key: string) => points.map((point, index) => ({ x: xAt(index), y: yAt(point.values[key] ?? 0) }));
  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const focusY = (index: number) => Math.min(...series.map((item) => yAt(points[index].values[item.key] ?? 0)));

  return (
    <div>
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`${series.map((item) => item.label).join(" and ")} trend`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series[0]?.color ?? "var(--chart-blue)"} stopOpacity={0.16} />
          <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridLines.map((fraction) => {
        const y = padding.top + plotHeight - fraction * plotHeight;
        return (
          <g key={fraction}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padding.left - 8} y={y + 3} fontSize={9} textAnchor="end" fill="var(--chart-muted)">
              {formatAxisValue(maxValue * fraction)}
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
      {series.length === 1 ? <path d={`${curvedPath(coordinates(series[0].key))} L${xAt(points.length - 1)},${padding.top + plotHeight} L${xAt(0)},${padding.top + plotHeight} Z`} fill={`url(#${gradientId})`} /> : null}
      {series.map((item) => <path key={item.key} d={curvedPath(coordinates(item.key))} fill="none" stroke={item.color} strokeWidth={2.5} strokeDasharray={item.dash} strokeLinejoin="round" strokeLinecap="round" />)}
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
          {series.map((item) => <circle key={item.key} cx={xAt(index)} cy={yAt(point.values[item.key] ?? 0)} r={point.isSelected ? 5.5 : 3.5} fill={item.color} stroke="#fcfcfb" strokeWidth={2} />)}
          <rect
            x={index === 0 ? padding.left : (xAt(index - 1) + xAt(index)) / 2}
            y={padding.top}
            width={(index === points.length - 1 ? width - padding.right : (xAt(index) + xAt(index + 1)) / 2) - (index === 0 ? padding.left : (xAt(index - 1) + xAt(index)) / 2)}
            height={plotHeight}
            fill="transparent"
            tabIndex={0}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
            aria-label={`${point.label}: ${series.map((item) => `${item.label} ${formatTooltipValue(point.values[item.key] ?? 0)}`).join(", ")}`}
          />
        </g>
      ))}
      {hovered !== null ? (
        <Tooltip
          x={xAt(hovered)}
          y={focusY(hovered)}
          width={width}
          lines={[{ label: points[hovered].isSelected ? `${points[hovered].label} (current period)` : points[hovered].label, value: "" }, ...series.map((item) => ({ label: item.label, value: formatTooltipValue(points[hovered].values[item.key] ?? 0), color: item.color }))]}
        />
      ) : null}
    </svg>
    <div className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Chart legend">
      {series.map((item) => <span key={item.key} className="inline-flex items-center gap-2 text-xs text-gray-600"><span aria-hidden className="inline-block size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </div>
    </div>
  );
}

export function TrendChart({
  points,
  valueFormat = "money",
  seriesLabel = "Customer collections",
}: {
  points: TrendPoint[];
  valueFormat?: "money" | "number";
  seriesLabel?: string;
}) {
  return <TrendLineChart points={points.map((point) => ({ label: point.label, isSelected: point.isSelected, values: { value: point.collected } }))} series={[{ key: "value", label: seriesLabel, color: "var(--chart-blue)" }]} valueFormat={valueFormat} />;
}

export function ComparisonTrendChart({ points }: { points: ComparisonTrendPoint[] }) {
  return <TrendLineChart points={points.map((point) => ({ label: point.label, isSelected: point.isSelected, values: { collected: point.collected, deposited: point.deposited } }))} series={[{ key: "collected", label: "Customer collections", color: "var(--chart-blue)" }, { key: "deposited", label: "Staff deposits", color: "var(--chart-good)", dash: "6 4" }]} valueFormat="money" />;
}

export function MultiTrendChart({ points, series, valueFormat = "money" }: { points: MultiTrendPoint[]; series: ChartSeries[]; valueFormat?: "money" | "number" }) {
  return <TrendLineChart points={points} series={series} valueFormat={valueFormat} />;
}

export function DonutChart({
  items,
  formatValue = (value) => value.toLocaleString(),
  emptyMessage,
  centerLabel = "Total",
}: {
  items: { key: string; label: string; value: number; color: string }[];
  formatValue?: (value: number) => string;
  emptyMessage: string;
  centerLabel?: string;
}) {
  const visibleItems = items.filter((item) => item.value > 0);
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <EmptyState message={emptyMessage} />;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)]">
      <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-52" role="img" aria-label={`${centerLabel}: ${formatValue(total)} across ${visibleItems.length} categories`}>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--chart-grid)" strokeWidth="24" />
        {visibleItems.map((item, index) => {
          const length = (item.value / total) * circumference;
          const currentOffset = visibleItems.slice(0, index).reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
          return <circle key={item.key} cx="100" cy="100" r={radius} fill="none" stroke={item.color} strokeWidth="24" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} transform="rotate(-90 100 100)" />;
        })}
        <text x="100" y="94" textAnchor="middle" fontSize="12" fill="var(--chart-muted)">{centerLabel}</text>
        <text x="100" y="118" textAnchor="middle" fontSize="21" fontWeight="700" fill="var(--chart-ink)">{formatValue(total)}</text>
      </svg>
      <ul className="space-y-2" aria-label="Chart legend">
        {visibleItems.map((item) => <li key={item.key} className="flex items-center justify-between gap-3 text-xs"><span className="inline-flex min-w-0 items-center gap-2 text-gray-700"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.label}</span></span><span className="shrink-0 font-semibold tabular-nums text-gray-950">{formatValue(item.value)} <span className="font-normal text-gray-500">({Math.round((item.value / total) * 100)}%)</span></span></li>)}
      </ul>
    </div>
  );
}

export function DotPlotChart({
  items,
  formatValue,
  emptyMessage,
}: {
  items: { key: string; label: string; value: number; color: string }[];
  formatValue: (value: number) => string;
  emptyMessage: string;
}) {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  const sorted = items.slice().sort((a, b) => b.value - a.value);
  const width = 660;
  const rowHeight = 32;
  const padding = { top: 16, right: 92, bottom: 28, left: 142 };
  const plotWidth = width - padding.left - padding.right;
  const height = padding.top + padding.bottom + sorted.length * rowHeight;
  const minValue = Math.min(0, ...sorted.map((item) => item.value));
  const maxValue = Math.max(0, ...sorted.map((item) => item.value));
  const range = Math.max(maxValue - minValue, 1);
  const domainMin = minValue < 0 ? minValue - range * 0.04 : 0;
  const domainMax = maxValue > 0 ? maxValue + range * 0.04 : 1;
  const xScale = (value: number) => padding.left + ((value - domainMin) / (domainMax - domainMin)) * plotWidth;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => domainMin + (domainMax - domainMin) * fraction);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Ranked value dot plot">
      {ticks.map((tick, index) => <g key={index}><line x1={xScale(tick)} y1={padding.top - 5} x2={xScale(tick)} y2={height - padding.bottom} stroke={tick === 0 ? "var(--chart-baseline)" : "var(--chart-grid)"} strokeWidth={tick === 0 ? 1.5 : 1} /><text x={xScale(tick)} y={height - 7} fontSize={9} textAnchor="middle" fill="var(--chart-muted)">{formatCompact(tick)}</text></g>)}
      {sorted.map((item, index) => {
        const y = padding.top + index * rowHeight;
        return (
          <g key={item.key}>
            <text
              x={padding.left - 12}
              y={y + 5}
              fontSize={9.5}
              textAnchor="end"
              fill="var(--chart-ink-secondary)"
            >
              <title>{item.label}</title>{truncateLabel(item.label, 21)}
            </text>
            <circle cx={xScale(item.value)} cy={y + 1} r={5.5} fill={item.color} stroke="white" strokeWidth={2} tabIndex={0} aria-label={`${item.label}: ${formatValue(item.value)}`} />
            <text
              x={width - padding.right + 12}
              y={y + 5}
              fontSize={9.5}
              fontWeight={600}
              fill="var(--chart-ink)"
            >
              {formatValue(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Small up/down/flat indicator for "this period vs last period" comparisons.
 * Reuses the same --chart-good/--chart-critical/--chart-muted tokens as the
 * rest of the analytics charts, so it needs a `glv-chart` ancestor (or to be
 * one itself) for the CSS custom properties to resolve.
 */
export function TrendBadge({
  current,
  previous,
  suffix = "vs last week",
}: {
  current: number;
  previous: number;
  suffix?: string;
}) {
  const delta = current - previous;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const pct =
    previous > 0
      ? Math.round((Math.abs(delta) / previous) * 100)
      : current > 0
        ? 100
        : 0;

  const color =
    direction === "up"
      ? "var(--chart-good)"
      : direction === "down"
        ? "var(--chart-critical)"
        : "var(--chart-muted)";
  const Icon = direction === "up" ? ArrowUpRightIcon : direction === "down" ? ArrowDownRightIcon : MinusIcon;
  const magnitude =
    previous === 0 && current === 0
      ? "No change"
      : previous === 0
        ? "New"
        : `${pct}%`;

  return (
    <span
      className="glv-chart inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color: "var(--chart-ink-secondary)" }}
      title={`${current.toLocaleString()} now vs ${previous.toLocaleString()} ${suffix.replace(/^vs /, "")}`}
    >
      <Icon className="size-3.5" style={{ color }} aria-hidden />
      <span>
        {magnitude} {suffix}
      </span>
    </span>
  );
}
