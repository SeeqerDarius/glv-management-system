import { Badge } from "@/components/ui/badge";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { formatMoney } from "@/lib/accounts";
import { getWeeklyStaffPerformanceReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function ReportsPage() {
  let report: Awaited<ReturnType<typeof getWeeklyStaffPerformanceReport>>;

  try {
    report = await getWeeklyStaffPerformanceReport();
  } catch {
    console.warn("Weekly staff report data is temporarily unavailable.");

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Weekly Staff Performance
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Monday to Sunday staff performance report.
          </p>
        </div>
        <DatabaseUnavailable retryHref="/reports" title="Reports are temporarily unavailable" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">
          Weekly Staff Performance
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Monday to Sunday report for {formatDate(report.start)} -{" "}
          {formatDate(report.end)}. Sunday summarizes the ending week.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Rank</th>
              <th className="p-3 font-medium">Staff Code</th>
              <th className="p-3 font-medium">Customers Added</th>
              <th className="p-3 font-medium">Accounts Opened</th>
              <th className="p-3 font-medium">Total Collected</th>
              <th className="p-3 font-medium">Completed Accounts</th>
              <th className="p-3 font-medium">Overdue Accounts</th>
              <th className="p-3 font-medium">Outstanding Balance</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.staffId} className="border-t">
                <td className="p-3">
                  <Badge variant={row.rank === 1 ? "default" : "secondary"}>
                    #{row.rank}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="font-semibold text-gray-950">{row.staffCode}</div>
                  <div className="text-xs text-gray-500">{row.staffName}</div>
                </td>
                <td className="p-3">{row.customersAdded}</td>
                <td className="p-3">{row.accountsOpened}</td>
                <td className="p-3">{formatMoney(row.totalCollected)}</td>
                <td className="p-3">{row.completedAccounts}</td>
                <td className="p-3">{row.overdueAccounts}</td>
                <td className="p-3">{formatMoney(row.outstandingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {report.rows.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No staff records found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
