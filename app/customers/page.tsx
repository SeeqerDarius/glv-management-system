import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export default async function CustomersPage() {
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
                  {customer.staff.fullName} ({customer.staff.code})
                </td>
                <td className="p-3">{customer.accounts.length}</td>
                <td className="p-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/customers/${customer.id}`}>View</Link>
                  </Button>
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
