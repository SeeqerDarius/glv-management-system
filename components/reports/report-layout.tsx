import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Presentational shell for the reports page. These are server components: the
 * page stays a single server render and only the charts ship client JS.
 */

export type MetricTone = "neutral" | "positive" | "negative" | "watch";

const TONE_ACCENT: Record<MetricTone, string> = {
  neutral: "var(--glv-lime)",
  positive: "var(--chart-good, #0ca30c)",
  negative: "var(--chart-critical, #d03b3b)",
  watch: "var(--chart-warning, #fab219)",
};

const TONE_VALUE: Record<MetricTone, string> = {
  neutral: "text-gray-950",
  positive: "text-green-700",
  negative: "text-red-700",
  watch: "text-amber-700",
};

/** One figure. `hint` carries the sentence an operator would otherwise ask for. */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  return (
    <div
      className="glv-metric-card glv-chart rounded-lg border bg-white p-4"
      style={{ "--metric-accent": TONE_ACCENT[tone] } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Fixed height for up to two lines so values line up across a row. */}
        <p className="min-h-8 text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600">
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={`mt-2 text-xl font-semibold tabular-nums ${TONE_VALUE[tone]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

/**
 * A labelled cluster of metrics. The reports page used to render fourteen
 * cards in one undifferentiated grid, which told an operator nothing about
 * which figures belong to the same question.
 */
export function MetricGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-gray-50/70 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </div>
  );
}

export function ReportSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-gray-600">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Anchor links for a page that is far taller than one screen. */
export function SectionNav({
  items,
}: {
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <nav
      aria-label="Report sections"
      className="flex flex-wrap gap-1 rounded-lg border bg-white p-1"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-lime-50 hover:text-gray-950"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export type ReportColumn = {
  label: string;
  align?: "left" | "right";
  /** Pins the column while the table scrolls sideways. */
  sticky?: boolean;
  srOnly?: boolean;
};

const alignClass = (align: ReportColumn["align"]) =>
  align === "right" ? "text-right" : "text-left";

/**
 * Table shell with a real header treatment, a pinned identity column and a
 * single empty-state style. Wide financial tables are unreadable without them.
 */
export function ReportTable({
  columns,
  minWidthClass,
  isEmpty,
  emptyMessage,
  children,
}: {
  columns: ReportColumn[];
  minWidthClass: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidthClass} text-sm`}>
          <thead>
            <tr className="border-b bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`p-3 text-xs font-semibold uppercase tracking-wide text-gray-600 ${alignClass(
                    column.align
                  )} ${
                    column.sticky
                      ? "sticky left-0 z-10 bg-gray-50 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200"
                      : ""
                  }`}
                >
                  {column.srOnly ? (
                    <span className="sr-only">{column.label}</span>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {isEmpty ? (
        <p className="border-t p-6 text-center text-sm text-gray-500">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr className="group/row border-t transition-colors hover:bg-lime-50/40">
      {children}
    </tr>
  );
}

/**
 * `numeric` gives money columns tabular figures so they line up down the
 * column, and stops a narrow column breaking "GHS 3,200.00" across two lines.
 */
export function Cell({
  children,
  align = "left",
  numeric = false,
  sticky = false,
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  numeric?: boolean;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`p-3 align-middle ${alignClass(align)} ${
        numeric ? "whitespace-nowrap tabular-nums" : ""
      } ${
        sticky
          ? "sticky left-0 z-10 bg-white transition-colors after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-gray-200 group-hover/row:bg-lime-50/40"
          : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
