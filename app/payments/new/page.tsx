import { AccountStatus, UserPermission, UserRole } from "@prisma/client";
import { PaymentForm } from "@/components/payment-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    accountId?: string;
  }>;
}) {
  const { customerId: selectedCustomerId, accountId: selectedAccountId } =
    await searchParams;
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const canManageAll = hasPermission(session?.user?.role, session?.user?.permissions, UserPermission.MANAGE_PAYMENTS);

  const accounts = await prisma.customerAccount.findMany({
    where: {
      balance: {
        gt: 0,
      },
      status: {
        notIn: [
          AccountStatus.COMPLETED,
          AccountStatus.CANCELLED,
          AccountStatus.SUSPENDED,
          AccountStatus.CLOSED,
        ],
      },
      ...(isStaff && !canManageAll && session.user.staffId
        ? {
            customer: {
              staffId: session.user.staffId,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: {
        select: {
          id: true,
          customerId: true,
          fullName: true,
        },
      },
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-950">Record Payment</h1>
        <p className="mt-1 text-sm text-gray-600">
          Select an active account and enter the amount received.
        </p>
      </div>

      <PaymentForm
        accounts={accounts}
        selectedCustomerId={selectedCustomerId}
        selectedAccountId={selectedAccountId}
      />
    </div>
  );
}
