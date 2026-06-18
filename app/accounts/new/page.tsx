import { UserRole } from "@prisma/client";
import { AccountForm } from "@/components/account-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewAccountPage() {
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where:
        isStaff && session.user.staffId
          ? {
              staffId: session.user.staffId,
            }
          : undefined,
      orderBy: {
        fullName: "asc",
      },
      include: {
        staff: {
          select: {
            code: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.product.findMany({
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
        layawayPrice: true,
        dailyAmount: true,
        duration: true,
      },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">
          Create Customer Account
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Select a customer, product, and start date. GLV will calculate the
          account terms automatically.
        </p>
      </div>

      <AccountForm customers={customers} products={products} />
    </div>
  );
}
