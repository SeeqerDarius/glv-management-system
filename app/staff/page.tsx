import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { SearchIcon, Pencil, Trash2, UserX } from "lucide-react";
import { deactivateStaff, deleteStaff } from "@/actions/staff";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { prisma } from "@/lib/prisma";

function money(value: number) {
  return `GHS ${value.toFixed(2)}`;
}

type StaffPageProps = {
  searchParams: Promise<{
    q?: string;
    error?: string;
    deleted?: string;
  }>;
};

type StaffListItem = Prisma.StaffGetPayload<{
  include: {
    user: true;
    _count: {
      select: {
        customers: true;
      };
    };
  };
}>;

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const { q, error, deleted } = await searchParams;
  const query = q?.trim() ?? "";
  let staff: StaffListItem[];

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
          },
        },
      },
    });

    staff = query
      ? allStaff.filter(
          (s) =>
            s.fullName.toLowerCase().includes(query.toLowerCase()) ||
            s.email.toLowerCase().includes(query.toLowerCase()) ||
            s.code.toLowerCase().includes(query.toLowerCase()) ||
            (s.phone ?? "").toLowerCase().includes(query.toLowerCase()),
        )
      : allStaff;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage GLV staff profiles and assignment codes.
          </p>
        </div>
        <Link
          href="/staff/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#123824] px-4 py-2 text-sm font-medium text-lime-400 transition hover:bg-[#1a4f33]"
        >
          <span className="text-lg leading-none">+</span> Add staff
        </Link>
      </div>

      {/* Toasts */}
      {error === "staff-has-history" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Staff with assigned customers cannot be deleted. Deactivate the staff
          member instead.
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
      <form className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, code, or phone"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
        />
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[940px] text-sm"
            style={{ tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
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
                  Email
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Phone
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Customers
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Monthly Salary
                </th>
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
              {staff.map((member) => (
                <tr
                  key={member.id}
                  className="group transition-colors hover:bg-gray-50/70"
                >
                  <td className="px-3 py-3 font-semibold text-gray-900 tabular-nums">
                    {member.code}
                  </td>
                  <td className="px-3 py-3 text-gray-900 truncate">
                    {member.fullName}
                  </td>
                  <td className="px-3 py-3 text-gray-700 truncate">
                    {member.email}
                  </td>
                  <td className="px-3 py-3 text-gray-700 tabular-nums">
                    {member.phone || "-"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {member._count.customers}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {money(member.monthlySalary)}
                  </td>
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
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        member.user
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {member.user ? "Created" : "Missing"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      {/* Edit */}
                      <Link
                        href={`/staff/${member.id}/edit`}
                        aria-label={`Edit ${member.fullName}`}
                        title="Edit"
                        className="
                          group/edit flex size-8 items-center justify-center rounded-md
                          text-gray-400 transition-all duration-150
                          hover:bg-lime-50 hover:text-green-700
                        "
                      >
                        <Pencil className="size-4 transition-transform duration-200 group-hover/edit:scale-125 group-hover/edit:rotate-12" />
                      </Link>

                      {/* Deactivate (only if active) */}
                      {member.active && (
                        <form action={deactivateStaff}>
                          <input type="hidden" name="id" value={member.id} />
                          <button
                            type="submit"
                            aria-label={`Deactivate ${member.fullName}`}
                            title="Deactivate"
                            className="
                              group/deact flex size-8 items-center justify-center rounded-md
                              text-gray-400 transition-all duration-150
                              hover:bg-amber-50 hover:text-amber-700
                            "
                          >
                            <UserX className="size-4 transition-transform duration-200 group-hover/deact:scale-125 group-hover/deact:-translate-y-0.5" />
                          </button>
                        </form>
                      )}

                      {/* Delete */}
                      <ConfirmDeleteForm
                        action={deleteStaff}
                        id={member.id}
                        title={`Delete ${member.fullName}?`}
                        hasLinkedHistory={member._count.customers > 0}
                        description="This permanently deletes the staff record. This cannot be undone."
                        triggerClassName="
                          group/del flex size-8 items-center justify-center rounded-md
                          text-gray-400 transition-all duration-150
                          hover:bg-red-50 hover:text-red-600
                        "
                      >
                        <Trash2 className="size-4 transition-transform duration-200 group-hover/del:scale-125 group-hover/del:-translate-y-0.5" />
                      </ConfirmDeleteForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {staff.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-14 text-center">
              <p className="text-sm font-medium text-gray-700">
                No staff found
              </p>
              <p className="text-xs text-gray-400">
                {query
                  ? `No results for "${query}". Try a different search.`
                  : "Add your first staff member to get started."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
