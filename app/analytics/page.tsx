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
          <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
          <p className="mt-2 text-xs text-gray-500">{detail}</p>
        </div>
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-lime-50 text-green-800">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel: string;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-gray-700">{label}</span>
        <span className="shrink-0 text-gray-500">{valueLabel}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-lime-500"
          style={{ width: `${width}%` }}
        />
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
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
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

  const maxTrendAmount = Math.max(
    ...analytics.collectionTrend.map((week) => week.amount),
    0
  );
  const maxProductAccounts = Math.max(
    ...analytics.productPerformance.map((product) => product.accounts),
    0
  );
  const maxStaffCollected = Math.max(
    ...analytics.staffPerformance.map((staff) => staff.collected),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-sm font-medium text-green-700">Business Analytics</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Operational signals from accounts, payments, products, procurement,
            inventory, and staff activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/reports">Weekly Report</Link>
          </Button>
          <Button asChild>
            <Link href="/products/procurement">Procurement</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Collections Trend"
          description="Weekly payment collection for the last eight weeks."
        >
          <div className="space-y-4">
            {analytics.collectionTrend.map((week) => (
              <BarRow
                key={week.label}
                label={week.label}
                value={week.amount}
                max={maxTrendAmount}
                valueLabel={formatMoney(week.amount)}
              />
            ))}
          </div>
        </SectionCard>

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
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Staff Performance"
          description="Collections and active account load by staff member."
        >
          <div className="space-y-4">
            {analytics.staffPerformance.map((staff) => (
              <BarRow
                key={staff.staffId}
                label={`${staff.staffName} (${staff.staffCode})`}
                value={staff.collected}
                max={maxStaffCollected}
                valueLabel={`${formatMoney(staff.collected)} | ${staff.accounts} accounts`}
              />
            ))}
            {analytics.staffPerformance.length === 0 ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                No staff activity available yet.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Product Demand"
          description="Top products by account count and collections."
        >
          <div className="space-y-4">
            {analytics.productPerformance.map((product) => (
              <BarRow
                key={product.productId}
                label={`${product.productName} | ${product.category}`}
                value={product.accounts}
                max={maxProductAccounts}
                valueLabel={`${product.accounts} accounts | ${formatMoney(product.totalPaid)}`}
              />
            ))}
            {analytics.productPerformance.length === 0 ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                No product account activity available yet.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
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
          {analytics.procurement.items.length === 0 ? (
            <p className="border-t py-8 text-center text-sm text-gray-600">
              No products are currently above the procurement threshold.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/products/procurement"
          className="group flex items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:border-lime-300 hover:bg-lime-50/40"
        >
          <div>
            <p className="font-semibold text-gray-950">Open Procurement List</p>
            <p className="mt-1 text-sm text-gray-600">
              View customers behind each procurement product and export Excel.
            </p>
          </div>
          <PackageSearchIcon className="size-5 text-gray-500 group-hover:text-green-700" />
        </Link>
        <Link
          href="/products"
          className="group flex items-center justify-between gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:border-lime-300 hover:bg-lime-50/40"
        >
          <div>
            <p className="font-semibold text-gray-950">Manage Products</p>
            <p className="mt-1 text-sm text-gray-600">
              Review products, images, sale stock, and staff allocations.
            </p>
          </div>
          <BoxesIcon className="size-5 text-gray-500 group-hover:text-green-700" />
        </Link>
      </div>
    </div>
  );
}
