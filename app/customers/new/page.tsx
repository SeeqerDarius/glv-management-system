import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === UserRole.ADMIN;
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Create Customer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Customer IDs are generated automatically from the assigned staff code.
        </p>
      </div>

      <form action={createCustomer} className="space-y-4 rounded-lg border bg-white p-5">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Full Name</span>
          <input name="fullName" className="w-full rounded border p-3" required />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Phone</span>
          <input name="phone" className="w-full rounded border p-3" required />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Address</span>
          <textarea name="address" className="min-h-24 w-full rounded border p-3" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">National ID</span>
          <input name="nationalId" className="w-full rounded border p-3" />
        </label>

        {isAdmin ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Assigned Staff</span>
            <select name="staffId" className="w-full rounded border p-3" required>
              <option value="">Select staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} ({member.code})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit">Create Customer</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/customers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
