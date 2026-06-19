import Link from "next/link";
import { UserRole } from "@prisma/client";
import { deleteCustomer } from "@/actions/customers";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { error, deleted } = await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;

  const customers = await prisma.customer.findMany({
    where:
      isStaff && session.user.staffId
        ? {
            staffId: session.user.staffId,
          }
        : undefined,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      staff: true,
      accounts: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">Customers</h1>
          <p className="mt-1 text-sm text-gray-600">
            View customer profiles and account history.
          </p>
        </div>

        <Button asChild>
          <Link href="/customers/new">Create Customer</Link>
        </Button>
      </div>

      {error === "delete-confirmation-required" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Type DELETE in the confirmation box before deleting customer records.
        </div>
      ) : null}

      {error === "admin-password-required" || error === "invalid-admin-password" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Enter a valid admin password before deleting customer records.
        </div>
      ) : null}

      {error === "customer-delete-blocked" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Customer deletion was blocked by related records. Remove or correct the related records first.
        </div>
      ) : null}

      {deleted === "customer" ? (
        <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-900">
          Customer and all related accounts and payments were permanently deleted.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
              <th className="p-3 font-medium">Customer ID</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Accounts</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="p-3 font-semibold text-gray-950">
                  {customer.customerId}
                </td>
                <td className="p-3">{customer.fullName}</td>
                <td className="p-3">{customer.phone}</td>
                <td className="p-3">
                  {customer.staff.code}
                </td>
                <td className="p-3">{customer.accounts.length}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/customers/${customer.id}`}>View</Link>
                    </Button>
                    {!isStaff ? (
                      <ConfirmDeleteForm
                        action={deleteCustomer}
                        id={customer.id}
                        title={`Delete ${customer.fullName}?`}
                        description="This permanently deletes the customer, every related account, and all payment records. This cannot be undone."
                      >
                        Delete
                      </ConfirmDeleteForm>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {customers.length === 0 ? (
          <div className="border-t p-8 text-center text-sm text-gray-600">
            No customers found.
          </div>
        ) : null}
      </div>
    </div>
  );
}
