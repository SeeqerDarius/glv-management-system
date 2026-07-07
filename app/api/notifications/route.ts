import { NextResponse } from "next/server";
import {
  AccountStatus,
  CreditStatus,
  DeliveryStatus,
  StaffApplicationStatus,
  UserPermission,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { getProcurementList } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/roles";
import { getEffectiveMonthlySalary } from "@/lib/salary-history";
import { previousSalaryMonthStart, salaryMonthEnd } from "@/lib/salary-periods";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attention: Record<
    string,
    { count: number; label: string; href: string }
  > = {};
  const staffScope = session.user.staffId
    ? { customer: { staffId: session.user.staffId } }
    : {};

  await refreshAccountLifecycleStatuses();

  const [accountAttentionCount, customersWithoutAccountsCount] =
    await Promise.all([
      prisma.customerAccount.count({
        where: {
          ...staffScope,
          OR: [
            { status: { in: [AccountStatus.OVERDUE, AccountStatus.SUSPENDED] } },
            {
              status: AccountStatus.COMPLETED,
              deliveryStatus: DeliveryStatus.PENDING,
            },
          ],
        },
      }),
      prisma.customer.count({
        where: {
          ...(session.user.staffId ? { staffId: session.user.staffId } : {}),
          accounts: { none: {} },
        },
      }),
    ]);

  if (accountAttentionCount > 0) {
    attention["/accounts"] = {
      count: accountAttentionCount,
      label: `${accountAttentionCount} account${
        accountAttentionCount === 1 ? "" : "s"
      } need follow-up`,
      href: "/accounts?status=OVERDUE",
    };
  }

  if (customersWithoutAccountsCount > 0) {
    attention["/customers"] = {
      count: customersWithoutAccountsCount,
      label: `${customersWithoutAccountsCount} customer${
        customersWithoutAccountsCount === 1 ? "" : "s"
      } without an account`,
      href: "/customers",
    };
  }

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PRODUCTS,
    )
  ) {
    const procurement = await getProcurementList();

    if (procurement.items.length > 0) {
      attention["/products"] = {
        count: procurement.items.length,
        label: `${procurement.items.length} product${
          procurement.items.length === 1 ? "" : "s"
        } ready for procurement`,
        href: "/products?tab=procurement",
      };
    }
  }

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PAYMENTS,
    )
  ) {
    const openCredits = await prisma.customerCredit.count({
      where: { status: CreditStatus.OPEN },
    });

    if (openCredits > 0) {
      attention["/credits"] = {
        count: openCredits,
        label: `${openCredits} open credit/refund item${
          openCredits === 1 ? "" : "s"
        } need review`,
        href: "/credits",
      };
    }
  }

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_STAFF,
    )
  ) {
    const pendingApplications = await prisma.staffApplication.count({
      where: { status: StaffApplicationStatus.PENDING },
    });

    if (pendingApplications > 0) {
      attention["/staff"] = {
        count: pendingApplications,
        label: `${pendingApplications} staff application${
          pendingApplications === 1 ? "" : "s"
        } pending approval`,
        href: "/staff/applications",
      };
    }
  }

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.VIEW_REPORTS,
    )
  ) {
    const salaryDueMonth = previousSalaryMonthStart();
    const salaryDueMonthEnd = salaryMonthEnd(salaryDueMonth);
    const staff = await prisma.staff.findMany({
      where: { active: true },
      include: {
        salaryHistory: { orderBy: { effectiveMonth: "asc" } },
        salaryPayments: {
          where: {
            salaryMonth: {
              gte: salaryDueMonth,
              lte: salaryDueMonthEnd,
            },
          },
        },
      },
    });
    const salaryBalances = staff.filter((member) => {
      const dueSalary = getEffectiveMonthlySalary(member, salaryDueMonth);
      const paid = member.salaryPayments.reduce(
        (total, payment) => total + payment.amount,
        0
      );
      return dueSalary - paid > 0;
    }).length;

    if (salaryBalances > 0) {
      attention["/reports"] = {
        count: salaryBalances,
        label: `${salaryBalances} staff salary balance${
          salaryBalances === 1 ? "" : "s"
        } need review`,
        href: "/reports#salary-tracking",
      };
    }
  }

  return NextResponse.json({ attention });
}
