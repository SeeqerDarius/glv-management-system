import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { SearchIcon, Eye, Pencil, Trash2, UserX } from "lucide-react";
import { deactivateStaff, deleteStaff } from "@/actions/staff";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { ProfileAvatar } from "@/components/profile-avatar";
import { StaffPasswordResetForm } from "@/components/staff-password-reset-form";
import { formatMoney } from "@/lib/accounts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

const onlineWindowMs = 5 * 60 * 1000;

function formatMinutesAgo(date: Date, now: Date) {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60000),
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getLoginPresence(user: StaffRow["user"], now: Date) {
  if (!user) {
    return {
      label: "Missing",
      detail: "No login",
      className: "bg-amber-100 text-amber-700",
    };
  }

  if (!user.lastSeenAt) {
    return {
      label: "Offline",
      detail: "No activity yet",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const isOnline =
    user.online && now.getTime() - user.lastSeenAt.getTime() <= onlineWindowMs;

  return {
    label: isOnline ? "Online" : "Offline",
    detail: isOnline ? "Active now" : formatMinutesAgo(user.lastSeenAt, now),
    className: isOnline
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600",
  };
}

type StaffPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    error?: string;
    deleted?: string;
  }>;
};
const staffSortOptions = [
  "newest",
  "oldest",
  "name-az",
  "code-az",
  "customers-high",
  "salary-high",
  "login-recent",
] as const;
type StaffSort = (typeof staffSortOptions)[number];

function isStaffSort(value: string): value is StaffSort {
  return staffSortOptions.includes(value as StaffSort);
}

type StaffListItem = Prisma.StaffGetPayload<{
  include: {
    user: true;
    _count: {
      select: {
        customers: true;
        salaryPayments: true;
      };
    };
  };
}>;

type StaffRow = StaffListItem & {
  passwordResetRequestedAt: Date | null;
};

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const { q, sort, error, deleted } = await searchParams;
  const session = await auth();
  const canManageStaff = isSuperAdminRole(session?.user?.role);
  const query = q?.trim() ?? "";
  const sortParam = sort ?? "";
  const selectedSort: StaffSort = isStaffSort(sortParam)
    ? sortParam
    : "name-az";
  const effectiveSort: StaffSort =
    selectedSort === "salary-high" && !canManageStaff ? "name-az" : selectedSort;
  const now = new Date();
  let staff: StaffRow[];

  try {
    const allStaff = await prisma.staff.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: true,
        _count: {
          select: {
            customers: true,
            salaryPayments: true,
          },
        },
      },
    });

    const userIds = allStaff
      .map((member) => member.user?.id)
      .filter((id): id is string => Boolean(id));
    const passwordAuditLogs = userIds.length
      ? await prisma.auditLog.findMany({
          where: {
            entity: "User",
            entityId: {
              in: userIds,
            },
            action: {
              in: ["PASSWORD_RESET_REQUEST", "RESET_STAFF_PASSWORD"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            action: true,
            entityId: true,
            createdAt: true,
          },
        })
      : [];
    const latestRequestByUserId = new Map<string, Date>();
    const latestResetByUserId = new Map<string, Date>();

    for (const log of passwordAuditLogs) {
      const targetMap =
        log.action === "PASSWORD_RESET_REQUEST"
          ? latestRequestByUserId
          : latestResetByUserId;

      if (!targetMap.has(log.entityId)) {
        targetMap.set(log.entityId, log.createdAt);
      }
    }

    const staffWithResetRequests = allStaff.map((member) => {
      const userId = member.user?.id;
      const requestedAt = userId ? latestRequestByUserId.get(userId) : undefined;
      const resetAt = userId ? latestResetByUserId.get(userId) : undefined;
      const hasPendingRequest =
        Boolean(requestedAt) && (!resetAt || requestedAt! > resetAt);

      return {
        ...member,
        passwordResetRequestedAt: hasPendingRequest ? requestedAt! : null,
      };
    });

    const filteredStaff = query
      ? staffWithResetRequests.filter(
          (s) =>
            s.fullName.toLowerCase().includes(query.toLowerCase()) ||
            s.email.toLowerCase().includes(query.toLowerCase()) ||
            s.code.toLowerCase().includes(query.toLowerCase()) ||
            (s.position ?? "").toLowerCase().includes(query.toLowerCase()) ||
            (s.phone ?? "").toLowerCase().includes(query.toLowerCase()),
        )
      : staffWithResetRequests;

    staff = [...filteredStaff].sort((a, b) => {
      switch (effectiveSort) {
        case "oldest":
          return a.createdAt.getTime() - b.createdAt.getTime();
        case "name-az":
          return a.fullName.localeCompare(b.fullName);
        case "code-az":
          return a.code.localeCompare(b.code);
        case "customers-high":
          return b._count.customers - a._count.customers;
        case "salary-high":
          return b.monthlySalary - a.monthlySalary;
        case "login-recent":
          return (
            (b.user?.lastSeenAt?.getTime() ?? 0) -
            (a.user?.lastSeenAt?.getTime() ?? 0)
          );
        case "newest":
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage GLV staff profiles and assignment codes.
          </p>
        </div>
        <DatabaseUnavailable
          retryHref="/staff"
          title="Staff data is temporarily unavailable"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">
            Staff Directory
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View GLV staff profiles and assignment codes.
          </p>
        </div>
        {canManageStaff ? (
          <Link
            href="/staff/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#123824] px-4 py-2 text-sm font-medium text-lime-400 transition hover:bg-[#1a4f33]"
          >
            <span className="text-lg leading-none">+</span> Add staff
          </Link>
        ) : null}
      </div>

      {/* Toasts */}
      {error === "staff-has-history" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Staff with assigned customers cannot be deleted. Deactivate the staff
          member instead.
        </div>
      )}
      {error === "staff-has-payroll-history" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Staff with salary payment history cannot be deleted. Deactivate the
          staff member instead so payroll reports stay intact.
        </div>
      )}
      {error === "delete-confirmation-required" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting staff records.
        </div>
      )}
      {(error === "admin-password-required" ||
        error === "invalid-admin-password") && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          Enter a valid admin password before deleting staff records.
        </div>
      )}
      {deleted === "staff" && (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-3.5 text-sm text-lime-900">
          Staff record deleted.
        </div>
      )}

      {/* Search */}
      <form className="grid w-full max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by name, email, code, position, or phone"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          />
        </div>
        <select
          name="sort"
          defaultValue={effectiveSort}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        >
          <option value="name-az">Name A-Z</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="code-az">Code A-Z</option>
          <option value="customers-high">Most customers</option>
          {canManageStaff ? (
            <option value="salary-high">Highest salary</option>
          ) : null}
          <option value="login-recent">Recent login</option>
        </select>
        <button
          type="submit"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="grid gap-3 md:hidden">
        {staff.map((member) => {
          const loginPresence = getLoginPresence(member.user, now);

          return (
            <div
              key={member.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <ProfileAvatar
                  name={member.fullName}
                  src={member.user?.profileImageUrl}
                  className="size-11"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-gray-400">
                    {member.code}
                  </p>
                  <h2 className="truncate text-base font-semibold text-gray-950">
                    {member.fullName}
                  </h2>
                  <p className="truncate text-sm text-gray-600">{member.email}</p>
                  {member.position ? (
                    <p className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {member.position}
                    </p>
                  ) : null}
                </div>
              </div>
              {member.passwordResetRequestedAt ? (
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Reset requested
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="font-medium text-gray-800">{member.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Customers</p>
                <p className="font-medium text-gray-800">
                  {member._count.customers}
                </p>
              </div>
              {canManageStaff ? (
              <div>
                <p className="text-xs text-gray-400">Salary</p>
                <p className="font-medium text-gray-800">
                  {formatMoney(member.monthlySalary)}
                </p>
              </div>
              ) : null}
              <div>
                <p className="text-xs text-gray-400">Login</p>
                <p className="font-medium text-gray-800">{loginPresence.label}</p>
                <p className="text-xs text-gray-500">{loginPresence.detail}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/staff/${member.id}`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View
              </Link>

              {canManageStaff ? (
                <Link
                  href={`/staff/${member.id}/edit`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
              ) : null}

              {canManageStaff && member.active && (
                <form action={deactivateStaff}>
                  <input type="hidden" name="id" value={member.id} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center justify-center rounded-md border border-amber-200 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Deactivate
                  </button>
                </form>
              )}

              {canManageStaff && member.user && member.passwordResetRequestedAt ? (
                <StaffPasswordResetForm
                  staffId={member.id}
                  staffName={member.fullName}
                  showLabel
                />
              ) : null}

              {canManageStaff ? (
                <ConfirmDeleteForm
                  action={deleteStaff}
                  id={member.id}
                  title={`Delete ${member.fullName}?`}
                  hasLinkedHistory={
                    member._count.customers > 0 ||
                    member._count.salaryPayments > 0
                  }
                  description={
                    member._count.customers > 0 ||
                    member._count.salaryPayments > 0
                      ? "This staff member has operational history and should be deactivated instead."
                      : "This permanently deletes the staff record. This cannot be undone."
                  }
                  triggerClassName="inline-flex h-9 items-center justify-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </ConfirmDeleteForm>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "80px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "200px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "90px" }} />
              {canManageStaff ? <col style={{ width: "110px" }} /> : null}
              <col style={{ width: "100px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Code
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Name
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Position
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Email
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Phone
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Customers
                </th>
                {canManageStaff ? (
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Monthly Salary
                </th>
                ) : null}
                <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Login
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {staff.map((member) => {
                const loginPresence = getLoginPresence(member.user, now);

                return (
                  <tr
                    key={member.id}
                    className="group transition-colors hover:bg-gray-50/70"
                  >
                  <td className="px-3 py-3 font-semibold text-gray-900 tabular-nums">
                    {member.code}
                  </td>
                  <td className="px-3 py-3 text-gray-900">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProfileAvatar
                        name={member.fullName}
                        src={member.user?.profileImageUrl}
                        className="size-8 text-xs"
                      />
                      <span className="truncate font-medium">
                        {member.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="truncate px-3 py-3 text-gray-700">
                    {member.position || "-"}
                  </td>
                  <td className="truncate px-3 py-3 text-gray-700">
                    {member.email}
                  </td>
                  <td className="truncate px-3 py-3 text-gray-700 tabular-nums">
                    {member.phone || "-"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {member._count.customers}
                  </td>
                  {canManageStaff ? (
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {formatMoney(member.monthlySalary)}
                  </td>
                  ) : null}
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        member.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {member.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${loginPresence.className}`}
                      >
                        {loginPresence.label}
                      </span>
                      <span className="text-[11px] leading-none text-gray-500">
                        {loginPresence.detail}
                      </span>
                      {member.passwordResetRequestedAt ? (
                        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                          Reset requested
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* View */}
                      <Link
                        href={`/staff/${member.id}`}
                        aria-label={`View ${member.fullName}`}
                        title="View"
                        className="group/view flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="size-4 transition-transform duration-200 group-hover/view:scale-125 group-hover/view:-rotate-6" />
                      </Link>

                      {/* Edit */}
                      {canManageStaff ? (
                        <Link
                          href={`/staff/${member.id}/edit`}
                          aria-label={`Edit ${member.fullName}`}
                          title="Edit"
                          className="group/edit flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-lime-50 hover:text-green-700"
                        >
                          <Pencil className="size-4 transition-transform duration-200 group-hover/edit:scale-125 group-hover/edit:rotate-12" />
                        </Link>
                      ) : null}

                      {/* Deactivate (only if active) */}
                      {canManageStaff && member.active && (
                        <form action={deactivateStaff}>
                          <input type="hidden" name="id" value={member.id} />
                          <button
                            type="submit"
                            aria-label={`Deactivate ${member.fullName}`}
                            title="Deactivate"
                            className="group/deact flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-amber-50 hover:text-amber-700"
                          >
                            <UserX className="size-4 transition-transform duration-200 group-hover/deact:scale-125 group-hover/deact:-translate-y-0.5" />
                          </button>
                        </form>
                      )}

                      {/* Password Reset */}
                      {canManageStaff && member.user && member.passwordResetRequestedAt ? (
                        <StaffPasswordResetForm
                          staffId={member.id}
                          staffName={member.fullName}
                        />
                      ) : null}

                      {/* Delete */}
                      {canManageStaff ? (
                        <ConfirmDeleteForm
                          action={deleteStaff}
                          id={member.id}
                          title={`Delete ${member.fullName}?`}
                          hasLinkedHistory={
                            member._count.customers > 0 ||
                            member._count.salaryPayments > 0
                          }
                          description={
                            member._count.customers > 0 ||
                            member._count.salaryPayments > 0
                              ? "This staff member has operational history and should be deactivated instead."
                              : "This permanently deletes the staff record. This cannot be undone."
                          }
                          triggerClassName="group/del flex size-8 items-center justify-center rounded-md text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
                        </ConfirmDeleteForm>
                      ) : null}
                    </div>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      </div>

      {staff.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white py-14 text-center">
          <p className="text-sm font-medium text-gray-700">No staff found</p>
          <p className="text-xs text-gray-400">
            {query
              ? `No results for "${query}". Try a different search.`
              : "Add your first staff member to get started."}
          </p>
        </div>
      )}
    </div>
  );
}
