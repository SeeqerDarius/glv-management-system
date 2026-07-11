import { prisma } from "@/lib/prisma";

type AuditLogsPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
  }>;
};

const auditSortOptions = [
  "newest",
  "oldest",
  "action-az",
  "entity-az",
  "user-az",
] as const;
type AuditSort = (typeof auditSortOptions)[number];

function isAuditSort(value: string): value is AuditSort {
  return auditSortOptions.includes(value as AuditSort);
}

function getAuditOrderBy(sort: AuditSort) {
  switch (sort) {
    case "oldest":      return { createdAt: "asc" } as const;
    case "action-az":   return { action: "asc" } as const;
    case "entity-az":   return { entity: "asc" } as const;
    case "user-az":     return { userId: "asc" } as const;
    case "newest":
    default:            return { createdAt: "desc" } as const;
  }
}

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

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function humanizeAction(action: string) {
  return action
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function humanizeKey(key: string) {
  return key
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return formatDate(date);
    }
    return value;
  }
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function pickEntityLabel(log: {
  entity: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  const value = parseJson(log.newValue) ?? parseJson(log.oldValue);
  const candidates = [
    "customerId", "receiptNo", "code", "fullName", "name",
    "email", "productName", "staffName", "companyName",
  ];
  for (const key of candidates) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  if (log.entityId.startsWith("bulk:")) {
    return `Bulk action (${log.entityId.replace("bulk:", "")} records)`;
  }
  return `${log.entity} record ${log.entityId.slice(0, 8)}`;
}

function detailEntries(value: string | null) {
  const parsed = parseJson(value);
  if (!parsed) return null;
  const noisyKeys = new Set(["id", "password", "oldValue", "newValue", "createdAt", "updatedAt"]);
  return Object.entries(parsed)
    .filter(([key, entryValue]) => !noisyKeys.has(key) && entryValue !== null)
    .slice(0, 8);
}

function actionVariant(action: string) {
  if (action.startsWith("CREATE") || action.startsWith("RECORD"))
    return "bg-lime-50 border-lime-300 text-green-700";
  if (action.startsWith("DELETE"))
    return "bg-red-50 border-red-200 text-red-700";
  if (action.startsWith("UPDATE") || action.startsWith("EDIT"))
    return "bg-blue-50 border-blue-200 text-blue-700";
  if (action.includes("RESET") || action.includes("PASSWORD"))
    return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-gray-50 border-gray-200 text-gray-600";
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const { q, sort } = await searchParams;
  const query = q?.trim() ?? "";
  const sortParam = sort ?? "";
  const selectedSort: AuditSort = isAuditSort(sortParam) ? sortParam : "newest";

  const logs = await prisma.auditLog.findMany({
    where: query
      ? {
          OR: [
            { action:   { contains: query, mode: "insensitive" } },
            { entity:   { contains: query, mode: "insensitive" } },
            { entityId: { contains: query, mode: "insensitive" } },
            { userId:   { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: getAuditOrderBy(selectedSort),
    take: 100,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(logs.map((l) => l.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const userNames = new Map(
    users.map((u) => [u.id, { name: u.name, email: u.email }])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only system activity trail for GLV administrative actions.
        </p>
      </div>

      {/* Search / sort toolbar */}
      <form className="grid max-w-2xl gap-2 sm:grid-cols-[1fr_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search action, entity, record, or user"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
        <select
          name="sort"
          defaultValue={selectedSort}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="action-az">Action A–Z</option>
          <option value="entity-az">Entity A–Z</option>
          <option value="user-az">User ID A–Z</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-[#123824] px-4 py-2 text-sm font-medium text-lime-400 transition hover:bg-[#1a4f33]"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Date", "Action", "Entity", "Record", "User", "Details"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const user = userNames.get(log.userId);
                const entries = detailEntries(log.newValue);
                return (
                  <tr key={log.id} className="align-top transition-colors hover:bg-gray-50/60">
                    {/* Date */}
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-gray-500">
                      {formatDate(log.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${actionVariant(log.action)}`}
                      >
                        {humanizeAction(log.action)}
                      </span>
                    </td>

                    {/* Entity */}
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                        {log.entity}
                      </span>
                    </td>

                    {/* Record */}
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">
                        {pickEntityLabel(log)}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-gray-400">
                        {log.entityId}
                      </p>
                    </td>

                    {/* User */}
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">
                        {user?.name ?? "System"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {user?.email ?? log.userId}
                      </p>
                    </td>

                    {/* Details */}
                    <td className="max-w-xs px-3 py-3">
                      {entries?.length ? (
                        <dl className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                          {entries.map(([key, value]) => (
                            <div
                              key={key}
                              className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]"
                            >
                              <dt className="font-medium text-gray-400">
                                {humanizeKey(key)}
                              </dt>
                              <dd className="break-words text-gray-700">
                                {formatValue(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {previewJson(log.newValue)}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {logs.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-14 text-center">
              <p className="text-sm font-medium text-gray-700">No audit logs found</p>
              <p className="text-xs text-gray-400">
                {query ? `No results for "${query}".` : "System actions will appear here."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
