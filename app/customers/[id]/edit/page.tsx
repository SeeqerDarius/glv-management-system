import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/actions/customers";
import { UserPermission } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, isAdminRole } from "@/lib/roles";

type EditCustomerPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function EditCustomerPage({
  params,
  searchParams,
}: EditCustomerPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await auth();
  const isAdmin = isAdminRole(session?.user?.role);
  const canManageAll = hasPermission(session?.user?.role, session?.user?.permissions, UserPermission.MANAGE_CUSTOMERS);

  const customer = await prisma.customer.findFirst({
    where: {
      id,
      ...(!canManageAll && session?.user?.staffId
        ? {
            staffId: session.user.staffId,
          }
        : {}),
    },
  });
  const staff = isAdmin
    ? await prisma.staff.findMany({
        where: {
          active: true,
        },
        orderBy: {
          fullName: "asc",
        },
      })
    : [];

  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Edit Customer</h1>
        <p className="mt-1 text-sm text-gray-600">{customer.customerId}</p>
      </div>

      {error === "admin-password-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter your admin password before changing the assigned staff member.
        </div>
      ) : null}

      {error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          The admin password was not correct. Staff assignment was not changed.
        </div>
      ) : null}

      <form action={updateCustomer} className="space-y-4 rounded-lg border bg-white p-5">
        <input type="hidden" name="id" value={customer.id} />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input
            name="fullName"
            defaultValue={customer.fullName}
            className="w-full rounded border p-3"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input
            name="phone"
            defaultValue={customer.phone}
            className="w-full rounded border p-3"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Address</span>
          <textarea
            name="address"
            defaultValue={customer.address ?? ""}
            className="min-h-24 w-full rounded border p-3"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            National ID{" "}
            <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <input
            name="nationalId"
            defaultValue={customer.nationalId ?? ""}
            className="w-full rounded border p-3"
          />
        </label>

        {isAdmin ? (
          <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">Assigned Staff</span>
              <select
                name="staffId"
                defaultValue={customer.staffId}
                className="w-full rounded border p-3"
                required
              >
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-700">
                Admin Password
              </span>
              <PasswordInput
                name="adminPassword"
                className="rounded border p-3"
                autoComplete="current-password"
              />
              <span className="text-xs text-amber-900">
                Required only when changing the customer&apos;s assigned staff.
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit">Save Changes</Button>
          <Button asChild type="button" variant="outline">
            <Link href={`/customers/${customer.id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
