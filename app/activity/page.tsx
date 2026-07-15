import { auth } from "@/lib/auth";
import { formatMoney } from "@/lib/accounts";
import { getActivityReport } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { ProductImagePreview } from "@/components/product-image-preview";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function BarRow({
  label,
  value,
  target,
  display,
  labelClassName = "",
}: {
  label: string;
  value: number;
  target: number;
  display: string;
  labelClassName?: string;
}) {
  const comparisonTarget = target > 0 ? target : value > 0 ? value * 2 : 0;
  const width =
    comparisonTarget > 0 && value > 0
      ? Math.min(100, Math.max(4, (value / comparisonTarget) * 100))
      : 0;

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)_minmax(7rem,12rem)] sm:items-center sm:gap-3">
      <p className={`min-w-0 break-words font-medium text-gray-700 ${labelClassName}`}>
        {label}
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-lime-400"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-left font-semibold tabular-nums text-gray-950 sm:text-right">
        {display}
      </p>
    </div>
  );
}

export default async function ActivityPage() {
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);
  let report: Awaited<ReturnType<typeof getActivityReport>>;

  try {
    report = await getActivityReport({
      staffId: isAdmin ? null : session?.user?.staffId,
      includeFinancialValues: isAdmin,
    });
  } catch (error) {
    console.error("ACTIVITY_LOAD_ERROR", error);
    return (
      <DatabaseUnavailable
        retryHref="/activity"
        title="Activity charts are temporarily unavailable"
      />
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <p className="text-sm font-medium text-green-700">
              Activity Intelligence
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950">
              Activity Charts
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {formatDate(report.start)} - {formatDate(report.end)}
            </p>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-950">
              {isAdmin ? "Weekly Collections" : "Payments This Week"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {isAdmin
                ? "Payment collection value by day."
                : "Recorded payment counts by day."}
            </p>
            <div className="mt-5 space-y-4">
              {report.weeklyPayments.map((payment) => (
                <BarRow
                  key={payment.label}
                  label={payment.label}
                  value={isAdmin ? payment.amount : payment.count}
                  target={isAdmin ? payment.expectedAmount : Math.max(payment.count, 1)}
                  display={
                    isAdmin
                      ? formatMoney(payment.amount)
                      : `${payment.count}`
                  }
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-950">
              Account Status
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Current installment account health.
            </p>
            <div className="mt-5 space-y-4">
              {report.accountStatus.map((status) => (
                <BarRow
                  key={status.status}
                  label={status.status}
                  value={status.count}
                  target={status.total}
                  display={`${status.count} / ${status.total}`}
                  labelClassName="text-xs sm:text-sm"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-950">
            {isAdmin ? "Staff Performance" : "My Performance"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin
              ? "Collection strength, assigned accounts, and outstanding balances."
              : "Assigned customer and account workload."}
          </p>
          <div className="mt-5 space-y-4">
            {report.staffPerformance.map((row) => (
              <div
                key={row.staffId}
                className="grid gap-3 rounded-lg border border-gray-100 p-4 md:grid-cols-[8rem_minmax(0,1fr)_10rem]"
              >
                <div>
                  <p className="font-bold text-gray-950">{row.staffCode}</p>
                  <p className="text-xs text-gray-500">{row.staffName}</p>
                </div>
                <div className="space-y-2">
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-lime-400"
                      style={{
                        width: `${
                          isAdmin && row.collected !== null
                            ? row.expectedWeeklyCollection > 0 && row.collected > 0
                              ? Math.min(
                                  100,
                                  Math.max(
                                    4,
                                    (row.collected / row.expectedWeeklyCollection) *
                                      100
                                  )
                                )
                              : 0
                            : row.accounts > 0
                              ? 100
                              : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {row.customers} customers • {row.accounts} accounts
                  </p>
                </div>
                {isAdmin ? (
                  <div className="text-right">
                    <p className="font-semibold text-gray-950">
                      {formatMoney(row.collected ?? 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Target {formatMoney(row.expectedWeeklyCollection)}
                    </p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="font-semibold text-gray-950">
                      {row.accounts} accounts
                    </p>
                    <p className="text-xs text-gray-500">
                      {row.customers} assigned customers
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-950">
            Recent Payment Activity
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <th className="p-3">Receipt</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Staff</th>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{payment.receiptNo}</td>
                    <td className="p-3">{payment.account.customer.fullName}</td>
                    <td className="p-3">{payment.account.customer.staff.code}</td>
                    <td className="p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <ProductImagePreview
                          src={payment.account.product.imageUrl}
                          alt={payment.account.product.name}
                          className="size-9 bg-white"
                          previewTitle={payment.account.product.name}
                        />
                        <span className="truncate">
                          {payment.account.product.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">
                No payment activity yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
}
