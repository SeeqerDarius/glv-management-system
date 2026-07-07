import Link from "next/link";
import { notFound } from "next/navigation";
import { updateStaff } from "@/actions/staff";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  assistantAdminPermissions,
  permissionLabels,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

type EditStaffPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditStaffPage({ params }: EditStaffPageProps) {
  const { id } = await params;
  const session = await auth();
  const canGrantPrivileges = isAdminRole(session?.user?.role);
  const canManageSalary = isAdminRole(session?.user?.role);
  const staff = await prisma.staff.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });

  if (!staff) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Edit Staff</h1>
        <p className="mt-1 text-sm text-gray-600">
          Update contact details, position, access, assignment code, and status.
        </p>
      </div>

      <form action={updateStaff} className="space-y-4 rounded-lg border bg-white p-5">
        <input type="hidden" name="id" value={staff.id} />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input
            name="fullName"
            defaultValue={staff.fullName}
            className="w-full border p-3 rounded"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={staff.email}
            className="w-full border p-3 rounded"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input
            name="phone"
            defaultValue={staff.phone ?? ""}
            className="w-full border p-3 rounded"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            Position / Rank
          </span>
          <input
            name="position"
            defaultValue={staff.position ?? ""}
            className="w-full rounded border p-3"
            placeholder="e.g. Procurement Officer, Supervisor"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Staff Code</span>
          <input
            name="code"
            defaultValue={staff.code}
            className="w-full border p-3 rounded uppercase"
            required
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={staff.active}
            className="size-4"
          />
          Active
        </label>

        {canManageSalary ? (
          <label className="block space-y-1 rounded-md border border-lime-200 bg-lime-50 p-4">
            <span className="text-sm font-semibold text-gray-900">Monthly Salary</span>
            <input
              name="monthlySalary"
              type="number"
              min="0"
              step="0.01"
              defaultValue={staff.monthlySalary}
              className="w-full rounded border p-3"
            />
            <span className="block text-xs text-gray-600">Editable monthly payroll amount for this staff member.</span>
          </label>
        ) : null}

        {canGrantPrivileges && staff.user ? (
          <fieldset className="space-y-3 rounded-md border border-lime-200 bg-lime-50 p-4">
            <div>
              <legend className="font-semibold text-gray-950">
                Assistant Admin Privileges
              </legend>
              <p className="mt-1 text-xs text-gray-600">
                These privileges extend access while the user&apos;s main role remains STAFF. Give Manage Products to let this staff member add products, view procurement, and download the procurement export.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {assistantAdminPermissions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 rounded-md border bg-white p-3 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission}
                    defaultChecked={staff.user?.permissions.includes(permission)}
                    className="size-4"
                  />
                  {permissionLabels[permission]}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit">Save Changes</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/staff">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
