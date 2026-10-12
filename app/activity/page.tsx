import { auth } from "@/lib/auth";
import { formatMoney } from "@/lib/accounts";
import { getActivityReport } from "@/lib/reports";
import { isAdminRole } from "@/lib/roles";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { UndoNotice, UndoPanel } from "@/components/undo-panel";
import { listUndoableActions } from "@/lib/undo";
import { ProductImagePreview } from "@/components/product-image-preview";
import { ActivityAnalyticsCharts } from "@/components/activity-analytics-charts";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);
  const undoableActions = isAdmin ? await listUndoableActions() : [];
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

        {isAdmin ? (
          <>
            <UndoNotice undone={query.undone} undoError={query.undoError} />
            <UndoPanel
              actions={undoableActions}
              returnTo="/activity"
              emptyMessage="Nothing has been done in the last three hours that can be retracted."
            />
          </>
        ) : null}

        <ActivityAnalyticsCharts
          weeklyPayments={report.weeklyPayments}
          accountStatus={report.accountStatus}
          staffPerformance={report.staffPerformance}
          isAdmin={isAdmin}
        />

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-950">
            {isAdmin ? "Staff Performance" : "My Performance"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin
              ? "Collection strength, assigned accounts, and outstanding balances."
              : "Assigned customer and account workload."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {report.staffPerformance.map((row) => (
              <div
                key={row.staffId}
                className="rounded-lg border border-gray-100 p-4"
              >
                <div>
                  <p className="font-bold text-gray-950">{row.staffCode}</p>
                  <p className="text-xs text-gray-500">{row.staffName}</p>
                </div>
                <div className="mt-2 space-y-2">
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
          
          {/* Mobile Card View */}
          <div className="mt-4 space-y-3 md:hidden">
            {report.recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-400">
                      {payment.receiptNo}
                    </p>
                    <p className="text-sm font-semibold text-gray-950">
                      {payment.account.customer.fullName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {payment.account.customer.staff.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-950">
                      {formatMoney(payment.amount)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ProductImagePreview
                    src={payment.account.product.imageUrl}
                    alt={payment.account.product.name}
                    className="size-8 bg-white"
                    previewTitle={payment.account.product.name}
                  />
                  <p className="truncate text-sm text-gray-700">
                    {payment.account.product.name}
                  </p>
                </div>
              </div>
            ))}
            {report.recentPayments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">
                No payment activity yet.
              </p>
            ) : null}
          </div>

          {/* Desktop Table View */}
          <div className="mt-4 hidden overflow-x-auto md:block">
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
