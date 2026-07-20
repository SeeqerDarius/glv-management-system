import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSignIcon,
  BoxesIcon,
  ChartNoAxesCombinedIcon,
  CircleAlertIcon,
  CircleCheckBigIcon,
  HandCoinsIcon,
  PackageCheckIcon,
  PackageSearchIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
import { UserPermission } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { formatMoney } from "@/lib/accounts";
import { getAnalyticsSummary } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/roles";

export const dynamic = "force-dynamic";

type ChartPoint = {
  label: string;
  value: number;
};

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof ChartNoAxesCombinedIcon;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold text-gray-950">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-lime-50 text-green-800">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function LineChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((point) => point.value), 1);
  const width = 640;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;
  const points = data.map((point, index) => {
    const x =
      padX + (data.length <= 1 ? 0 : (index / (data.length - 1)) * plotWidth);
    const y = padY + plotHeight - (point.value / max) * plotHeight;

    return { ...point, x, y };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${path} L ${points.at(-1)?.x ?? padX} ${height - padY} L ${padX} ${height - padY} Z`;

  return (
    <div className="overflow-hidden rounded-lg bg-gray-50 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <path d={areaPath} fill="#ecfccb" />
        <path d={path} fill="none" stroke="#65a30d" strokeWidth="5" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#166534" />
            <title>{`${point.label}: ${formatMoney(point.value)}`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
        {data.map((point) => (
          <div key={point.label} className="min-w-0">
            <p className="truncate font-medium text-gray-700">{point.label}</p>
            <p>{formatMoney(point.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="grid h-64 grid-cols-[repeat(auto-fit,minmax(42px,1fr))] items-end gap-2 rounded-lg bg-gray-50 p-3">
      {data.map((point) => {
        const height = Math.max((point.value / max) * 100, point.value > 0 ? 4 : 0);

        return (
          <div key={point.label} className="flex h-full min-w-0 flex-col justify-end gap-2">
            <div className="flex h-full items-end">
              <div
                className="w-full rounded-t-md bg-green-700"
                style={{ height: `${height}%` }}
                title={`${point.label}: ${point.value}`}
              />
            </div>
            <p className="truncate text-center text-[0.68rem] font-medium text-gray-600">
              {point.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const chartSegments = segments.reduce<
    Array<DonutSegment & { dash: number; offset: number }>
  >((items, segment) => {
    const dash = total > 0 ? (segment.value / total) * circumference : 0;
    const offset = items.reduce((sum, item) => sum + item.dash, 0);

    return [...items, { ...segment, dash, offset }];
  }, []);

  return (
    <div className="grid gap-5 rounded-lg bg-gray-50 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <svg viewBox="0 0 120 120" className="mx-auto size-44">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {chartSegments.map((segment) => (
          <circle
            key={segment.label}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="18"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          >
            <title>{`${segment.label}: ${segment.value}`}</title>
          </circle>
        ))}
        <text x="60" y="56" textAnchor="middle" className="fill-gray-950 text-lg font-bold">
          {total}
        </text>
        <text x="60" y="73" textAnchor="middle" className="fill-gray-500 text-[0.6rem] font-medium">
          accounts
        </text>
      </svg>
      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="truncate font-medium text-gray-700">{segment.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-gray-950">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankedList({
  data,
  valueLabel,
}: {
  data: ChartPoint[];
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0);

        return (
          <div key={item.label} className="rounded-lg border border-gray-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="min-w-0 flex-1 truncate font-medium text-gray-800">
                {item.label}
              </p>
              <p className="shrink-0 text-gray-500">{valueLabel(item.value)}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-lime-500" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await auth();
  const canViewAnalytics = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.VIEW_REPORTS
  );

  if (!canViewAnalytics) {
    redirect("/dashboard");
  }

  let analytics: Awaited<ReturnType<typeof getAnalyticsSummary>>;

  try {
    analytics = await getAnalyticsSummary();
  } catch (error) {
    console.error("ANALYTICS_LOAD_ERROR", error);
    return (
      <DatabaseUnavailable
        retryHref="/analytics"
        title="Analytics are temporarily unavailable"
      />
    );
  }

  const statusSegments = [
    {
      label: "Active",
      value: analytics.totals.activeAccounts,
      color: "#65a30d",
    },
    {
      label: "Completed",
      value: analytics.totals.completedAccounts,
      color: "#0284c7",
    },
    {
      label: "Overdue",
      value: analytics.totals.overdueAccounts,
      color: "#dc2626",
    },
  ];
  const productColumns = analytics.productPerformance.slice(0, 7).map((product) => ({
    label: product.productName,
    value: product.accounts,
  }));
  const staffRanking = analytics.staffPerformance.slice(0, 8).map((staff) => ({
    label: `${staff.staffName} (${staff.staffCode})`,
    value: staff.collected,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-700">Business Analytics</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
            Operational signals from accounts, payments, products, procurement,
            inventory, and staff activity.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/reports">Weekly Report</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/products?tab=procurement">Procurement</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Collected This Month"
          value={formatMoney(analytics.totals.collectedThisMonth)}
          detail={`${formatMoney(analytics.totals.collectedToday)} collected today`}
          icon={HandCoinsIcon}
        />
        <MetricCard
          label="Outstanding Balance"
          value={formatMoney(analytics.totals.outstandingBalance)}
          detail={`${analytics.totals.activeAccounts} active accounts`}
          icon={BadgeDollarSignIcon}
        />
        <MetricCard
          label="Collection Progress"
          value={`${analytics.totals.collectionProgress}%`}
          detail={`${formatMoney(analytics.totals.totalPaid)} of ${formatMoney(analytics.totals.totalTarget)}`}
          icon={TrendingUpIcon}
        />
        <MetricCard
          label="Needs Delivery"
          value={analytics.totals.pendingDeliveryAccounts}
          detail="Fully paid accounts still pending delivery"
          icon={PackageCheckIcon}
        />
        <MetricCard
          label="Customers"
          value={analytics.totals.customers}
          detail={`${analytics.totals.newCustomersThisMonth} added this month`}
          icon={UsersIcon}
        />
        <MetricCard
          label="Accounts"
          value={analytics.totals.accounts}
          detail={`${analytics.totals.newAccountsThisMonth} opened this month`}
          icon={WalletCardsIcon}
        />
        <MetricCard
          label="Overdue Accounts"
          value={analytics.totals.overdueAccounts}
          detail={`${analytics.totals.completedAccounts} completed accounts`}
          icon={CircleAlertIcon}
        />
        <MetricCard
          label="Open Credits"
          value={formatMoney(analytics.totals.openCreditAmount)}
          detail={`${analytics.totals.openCreditCount} open credit records`}
          icon={CircleCheckBigIcon}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Collections Trend"
          description="Line chart showing weekly payment collection for the last eight weeks."
        >
          <LineChart
            data={analytics.collectionTrend.map((week) => ({
              label: week.label,
              value: week.amount,
            }))}
          />
        </SectionCard>

        <SectionCard
          title="Account Status Mix"
          description="A quick view of active, completed, and overdue customer accounts."
        >
          <DonutChart segments={statusSegments} />
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Product Demand"
          description="Column chart showing products with the strongest account demand."
        >
          {productColumns.length > 0 ? (
            <ColumnChart data={productColumns} />
          ) : (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              No product account activity available yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Staff Collections"
          description="Ranked collection view by staff member."
        >
          {staffRanking.length > 0 ? (
            <RankedList data={staffRanking} valueLabel={formatMoney} />
          ) : (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              No staff activity available yet.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Inventory Signals"
          description="Stock allocated to staff and items that need restocking."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-lime-50 p-3">
              <p className="text-xs font-medium uppercase text-green-800">
                Allocated Stock
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {analytics.inventory.totalAllocated}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium uppercase text-amber-800">
                Low Stock
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {analytics.inventory.lowStockCount}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs font-medium uppercase text-red-800">
                Zero Stock
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {analytics.inventory.zeroStockCount}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[...analytics.inventory.zeroStockItems, ...analytics.inventory.lowStockItems]
              .slice(0, 6)
              .map((item) => (
                <div
                  key={`${item.staff.id}-${item.product.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-950">
                      {item.product.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {item.staff.fullName} ({item.staff.code})
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                    {item.quantity}
                  </span>
                </div>
              ))}
            {analytics.inventory.lowStockCount + analytics.inventory.zeroStockCount ===
            0 ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                No low-stock staff inventory items right now.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Procurement Readiness"
          description={`Products with customers at or above the ${analytics.procurement.thresholdPercent}% procurement threshold.`}
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-lime-50 p-3">
              <p className="text-xs font-medium uppercase text-green-800">
                Procurement Units
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {analytics.procurement.totalQuantity}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase text-gray-500">
                Estimated Cost
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {formatMoney(analytics.procurement.totalCost)}
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-xs font-medium uppercase text-sky-800">
                Active Products
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">
                {analytics.totals.activeProducts}/{analytics.totals.products}
              </p>
            </div>
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Units</th>
                  <th className="p-3 text-right">Highest Progress</th>
                  <th className="p-3 text-right">Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {analytics.procurement.items.map((item) => (
                  <tr key={item.productId} className="border-b last:border-0">
                    <td className="p-3 font-medium text-gray-950">
                      <Link
                        href={`/products/procurement/${item.productId}`}
                        className="hover:text-green-700 hover:underline"
                      >
                        {item.productName}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-600">{item.category}</td>
                    <td className="p-3 text-right font-semibold">{item.quantity}</td>
                    <td className="p-3 text-right">
                      {Math.round(item.highestProgress * 100)}%
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(item.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {analytics.procurement.items.map((item) => (
              <Link
                key={item.productId}
                href={`/products/procurement/${item.productId}`}
                className="block rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-950">{item.productName}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.category}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-lime-100 px-2 py-1 text-xs font-semibold text-green-900">
                    {item.quantity} units
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <span>{Math.round(item.highestProgress * 100)}% paid</span>
                  <span className="text-right font-semibold text-gray-950">
                    {formatMoney(item.totalCost)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {analytics.procurement.items.length === 0 ? (
            <p className="border-t py-8 text-center text-sm text-gray-600">
              No products are currently above the procurement threshold.
            </p>
          ) : null}
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/products?tab=procurement"
          className="group flex items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:border-lime-300 hover:bg-lime-50/40"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-950">Open Procurement List</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              View customers behind each procurement product and export Excel.
            </p>
          </div>
          <PackageSearchIcon className="size-5 shrink-0 text-gray-500 group-hover:text-green-700" />
        </Link>
        <Link
          href="/products"
          className="group flex items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:border-lime-300 hover:bg-lime-50/40"
        >
          <div className="min-w-0">
            <p className="font-semibold text-gray-950">Manage Products</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Review products, images, sale stock, and staff allocations.
            </p>
          </div>
          <BoxesIcon className="size-5 shrink-0 text-gray-500 group-hover:text-green-700" />
        </Link>
      </div>
    </div>
  );
}
