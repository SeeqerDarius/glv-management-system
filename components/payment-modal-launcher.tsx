import { AccountStatus, UserPermission, UserRole } from "@prisma/client";
import type { ReactNode } from "react";
import { PaymentModal } from "@/components/payment-modal";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";

export async function PaymentModalLauncher({
  trigger,
}: {
  trigger?: ReactNode;
}) {
  const session = await auth();
  const isStaff = session?.user?.role === UserRole.STAFF;
  const canManageAll = hasPermission(
    session?.user?.role,
    session?.user?.permissions,
    UserPermission.MANAGE_PAYMENTS
  );

  const accounts = await prisma.customerAccount.findMany({
    where: {
      balance: { gt: 0 },
      status: {
        notIn: [
          AccountStatus.COMPLETED,
          AccountStatus.CANCELLED,
          AccountStatus.SUSPENDED,
          AccountStatus.CLOSED,
          AccountStatus.ARCHIVED,
        ],
      },
      ...(isStaff && !canManageAll && session?.user?.staffId
        ? { customer: { staffId: session.user.staffId } }
        : isStaff && !canManageAll
          ? { id: "__no_accessible_accounts__" }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      balance: true,
      dailyAmount: true,
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
          imageUrl: true,
        },
      },
    },
  });

  return <PaymentModal accounts={accounts} trigger={trigger} />;
}
