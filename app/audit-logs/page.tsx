import { Badge } from "@/components/ui/badge";
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
    case "oldest":
      return { createdAt: "asc" } as const;
    case "action-az":
      return { action: "asc" } as const;
    case "entity-az":
      return { entity: "asc" } as const;
    case "user-az":
      return { userId: "asc" } as const;
    case "newest":
    default:
      return { createdAt: "desc" } as const;
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
    "customerId",
    "receiptNo",
    "code",
    "fullName",
    "name",
    "email",
    "productName",
    "staffName",
    "companyName",
  ];

  for (const key of candidates) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  if (log.entityId.startsWith("bulk:")) {
    return `Bulk action (${log.entityId.replace("bulk:", "")} records)`;
  }

  return `${log.entity} record ${log.entityId.slice(0, 8)}`;
}

function detailEntries(value: string | null) {
  const parsed = parseJson(value);
  if (!parsed) return null;

  const noisyKeys = new Set([
    "id",
    "password",
    "oldValue",
    "newValue",
    "createdAt",
    "updatedAt",
  ]);
  return Object.entries(parsed)
    .filter(([key, entryValue]) => !noisyKeys.has(key) && entryValue !== null)
    .slice(0, 8);
}

export default async function AuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
  const { q, sort } = await searchParams;
  const query = q?.trim() ?? "";
  const sortParam = sort ?? "";
  const selectedSort: AuditSort = isAuditSort(sortParam)
    ? sortParam
    : "newest";

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
    orderBy: getAuditOrderBy(selectedSort),
    take: 100,
  });
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: Array.from(new Set(logs.map((log) => log.userId))),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
  const userNames = new Map(
    users.map((user) => [user.id, `${user.name} (${user.email})`])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Read-only system activity trail for GLV administrative actions.
        </p>
      </div>

      <form className="grid max-w-3xl gap-2 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search action, entity, record, or user"
          className="w-full rounded border bg-white p-3"
        />
        <select
          name="sort"
          defaultValue={selectedSort}
          className="w-full rounded border bg-white p-3 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="action-az">Action A-Z</option>
          <option value="entity-az">Entity A-Z</option>
          <option value="user-az">User ID A-Z</option>
        </select>
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
              <th className="p-3 font-medium">Record</th>
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t align-top">
                <td className="p-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="p-3">
                  <Badge variant="outline">{humanizeAction(log.action)}</Badge>
                </td>
                <td className="p-3">{log.entity}</td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">
                    {pickEntityLabel(log)}
                  </p>
                  <p className="mt-1 font-mono text-[0.68rem] text-gray-500">
                    {log.entityId}
                  </p>
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">
                    {userNames.get(log.userId) ?? "System user"}
                  </p>
                  <p className="mt-1 font-mono text-[0.68rem] text-gray-500">
                    {log.userId}
                  </p>
                </td>
                <td className="max-w-md p-3">
                  {detailEntries(log.newValue)?.length ? (
                    <dl className="grid gap-1 rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {detailEntries(log.newValue)?.map(([key, value]) => (
                        <div key={key} className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
                          <dt className="font-semibold text-gray-500">
                            {humanizeKey(key)}
                          </dt>
                          <dd className="break-words">{formatValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                      {previewJson(log.newValue)}
                    </pre>
                  )}
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
