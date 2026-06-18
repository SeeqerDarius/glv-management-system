import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { updateCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type EditCustomerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const [customer, staff] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id,
        ...(!isAdmin && session?.user?.staffId
          ? {
              staffId: session.user.staffId,
            }
          : {}),
      },
    }),
    isAdmin
      ? prisma.staff.findMany({
          where: {
            active: true,
          },
          orderBy: {
            fullName: "asc",
          },
        })
      : Promise.resolve([]),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Edit Customer</h1>
        <p className="mt-1 text-sm text-gray-600">{customer.customerId}</p>
      </div>

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
          <span className="text-sm font-medium text-gray-700">National ID</span>
          <input
            name="nationalId"
            defaultValue={customer.nationalId ?? ""}
            className="w-full rounded border p-3"
          />
        </label>

        {isAdmin ? (
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
