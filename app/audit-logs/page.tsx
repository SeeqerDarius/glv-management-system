import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

type AuditLogsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function previewJson(value: string | null) {
  if (!value) return "-";

  try {
    const parsed = JSON.parse(value) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export default async function AuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const logs = await prisma.auditLog.findMany({
    where: query
      ? {
          OR: [
            {
              action: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              entity: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              entityId: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              userId: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Read-only system activity trail for GLV administrative actions.
        </p>
      </div>

      <form className="flex max-w-xl flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search action, entity, record, or user"
          className="w-full rounded border bg-white p-3"
        />
        <button
          type="submit"
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-[980px] text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Action</th>
              <th className="p-3 font-medium">Entity</th>
              <th className="p-3 font-medium">Entity ID</th>
              <th className="p-3 font-medium">User ID</th>
              <th className="p-3 font-medium">New Value</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="p-3">
                  <Badge variant="outline">{log.action}</Badge>
                </td>
                <td className="p-3">{log.entity}</td>
                <td className="p-3 font-mono text-xs">{log.entityId}</td>
                <td className="p-3 font-mono text-xs">{log.userId}</td>
                <td className="max-w-md p-3">
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                    {previewJson(log.newValue)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {logs.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No audit logs found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
