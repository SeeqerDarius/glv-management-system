import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PencilIcon, Trash2Icon, UserXIcon } from "lucide-react";
import { deactivateStaff, deleteStaff } from "@/actions/staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { DatabaseUnavailable } from "@/components/database-unavailable";
import { prisma } from "@/lib/prisma";

type StaffPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
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
  const { error, deleted } = await searchParams;
  let staff: StaffListItem[];

  try {
    staff = await prisma.staff.findMany({
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
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Staff Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage GLV staff profiles and assignment codes.
          </p>
        </div>
        <DatabaseUnavailable retryHref="/staff" title="Staff data is temporarily unavailable" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage GLV staff profiles and assignment codes.
          </p>
        </div>

        <Button asChild>
          <Link href="/staff/new">Add Staff</Link>
        </Button>
      </div>

      {error === "staff-has-history" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Staff with assigned customers cannot be deleted. Deactivate the staff member instead.
        </div>
      ) : null}

      {error === "delete-confirmation-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting staff records.
        </div>
      ) : null}

      {error === "admin-password-required" || error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before deleting staff records.
        </div>
      ) : null}

      {deleted === "staff" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Staff record deleted.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Customers</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Login</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>

          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {member.code}
                </td>
                <td className="p-3">{member.fullName}</td>
                <td className="p-3">{member.email}</td>
                <td className="p-3">{member.phone || "-"}</td>
                <td className="p-3">{member._count.customers}</td>
                <td className="p-3">
                  <Badge variant={member.active ? "default" : "secondary"}>
                    {member.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={member.user ? "default" : "secondary"}>
                    {member.user ? "Created" : "Missing"}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={`/staff/${member.id}/edit`} title="Edit staff">
                        <PencilIcon />
                        <span className="sr-only">Edit staff</span>
                      </Link>
                    </Button>
                    {member.active ? (
                      <form action={deactivateStaff}>
                        <input type="hidden" name="id" value={member.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="icon-sm"
                          title="Deactivate staff"
                        >
                          <UserXIcon />
                          <span className="sr-only">Deactivate staff</span>
                        </Button>
                      </form>
                    ) : null}
                    <ConfirmDeleteForm
                      action={deleteStaff}
                      id={member.id}
                      title={`Delete ${member.fullName}?`}
                      buttonSize="icon-sm"
                    >
                      <Trash2Icon />
                      <span className="sr-only">Delete staff</span>
                    </ConfirmDeleteForm>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {staff.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No staff records yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
