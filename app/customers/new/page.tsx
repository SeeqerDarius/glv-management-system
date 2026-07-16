import { UserRole } from "@prisma/client";
import { createCustomer } from "@/actions/customers";
import { CustomerForm } from "@/components/customer-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerPage() {
  const session = await auth();
  const canAssignStaff = session?.user?.role === UserRole.ADMIN || session?.user?.role === UserRole.SUPER_ADMIN;
  const staff = canAssignStaff
    ? await prisma.staff.findMany({
        where: {
          active: true,
        },
        orderBy: {
          fullName: "asc",
        },
      })
    : [];
  const products = await prisma.product.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      category: true,
      imageUrl: true,
      layawayPrice: true,
      dailyAmount: true,
      duration: true,
      staffInventory: {
        select: {
          staffId: true,
          quantity: true,
        },
      },
    },
  });
  const existingCustomers = await prisma.customer.findMany({
    orderBy: {
      fullName: "asc",
    },
    select: {
      id: true,
      fullName: true,
      customerId: true,
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Create Customer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Customer IDs are generated automatically from the assigned staff code.
        </p>
      </div>

      <CustomerForm
        action={createCustomer}
        staff={staff}
        products={products}
        existingCustomers={existingCustomers}
        canAssignStaff={canAssignStaff}
        currentStaffId={session?.user?.staffId ?? null}
      />
    </div>
  );
}
