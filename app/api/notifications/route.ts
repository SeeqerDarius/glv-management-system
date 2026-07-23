import { NextResponse } from "next/server";
import {
  AccountStatus,
  CreditStatus,
  DeliveryStatus,
  StaffApplicationStatus,
  UserPermission,
  ProfileChangeStatus,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { getProcurementList } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";
import { hasPermission, isSuperAdminRole } from "@/lib/roles";
import { getEffectiveMonthlySalary } from "@/lib/salary-history";
import { previousSalaryMonthStart, salaryMonthEnd } from "@/lib/salary-periods";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type AttentionItem = {
  count: number;
  label: string;
  href: string;
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addAttention(
  attention: Record<string, AttentionItem>,
  key: string,
  item: AttentionItem,
) {
  if (item.count <= 0) {
    return;
  }

  const existing = attention[key];
  if (!existing) {
    attention[key] = item;
    return;
  }

  attention[key] = {
    count: existing.count + item.count,
    label: `${existing.label}; ${item.label}`,
    href: existing.href,
  };
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attention: Record<string, AttentionItem> = {};
  try {
    const staffScope = session.user.staffId
      ? { customer: { staffId: session.user.staffId } }
      : {};
    const customerScope = session.user.staffId
      ? { staffId: session.user.staffId }
      : {};
    const todayStart = startOfToday();

    await refreshAccountLifecycleStatuses();

    const [
      accountAttentionCount,
      customersWithoutAccountsCount,
      newCustomersToday,
      newAccountsToday,
      newPaymentsToday,
    ] =
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
            ...customerScope,
            accounts: { none: {} },
          },
        }),
        prisma.customer.count({
          where: {
            ...customerScope,
            createdAt: { gte: todayStart },
          },
        }),
        prisma.customerAccount.count({
          where: {
            ...staffScope,
            createdAt: { gte: todayStart },
          },
        }),
        prisma.payment.count({
          where: {
            ...(session.user.staffId
              ? { account: { customer: { staffId: session.user.staffId } } }
              : {}),
            createdAt: { gte: todayStart },
          },
        }),
      ]);

  if (accountAttentionCount > 0) {
    addAttention(attention, "/accounts", {
      count: accountAttentionCount,
      label: `${plural(accountAttentionCount, "account")} need follow-up`,
      href: "/accounts?status=OVERDUE",
    });
  }

  if (customersWithoutAccountsCount > 0) {
    addAttention(attention, "/customers", {
      count: customersWithoutAccountsCount,
      label: `${plural(
        customersWithoutAccountsCount,
        "customer",
      )} without an account`,
      href: "/customers",
    });
  }

  const activityCount = newCustomersToday + newAccountsToday + newPaymentsToday;
  if (activityCount > 0) {
    const activityParts = [
      newCustomersToday > 0
        ? plural(newCustomersToday, "new customer")
        : null,
      newAccountsToday > 0 ? plural(newAccountsToday, "new account") : null,
      newPaymentsToday > 0 ? plural(newPaymentsToday, "new payment") : null,
    ].filter(Boolean);

    addAttention(attention, "/activity", {
      count: activityCount,
      label: `${activityParts.join(", ")} recorded today`,
      href: "/activity",
    });
  }

  if (
    hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PRODUCTS,
    )
  ) {
    const [procurement, productsMissingImages, inactiveProductsForSale] =
      await Promise.all([
        getProcurementList(),
        prisma.product.count({
          where: {
            active: true,
            OR: [{ imageUrl: null }, { imageUrl: "" }],
          },
        }),
        prisma.product.count({
          where: {
            active: false,
            quantityOnSale: { gt: 0 },
          },
        }),
      ]);

    if (procurement.items.length > 0) {
      addAttention(attention, "/products", {
        count: procurement.items.length,
        label: `${plural(
          procurement.items.length,
          "product",
        )} ready for procurement`,
        href: "/products?tab=procurement",
      });
    }

    if (productsMissingImages > 0) {
      addAttention(attention, "/products", {
        count: productsMissingImages,
        label: `${plural(productsMissingImages, "product")} missing images`,
        href: "/products",
      });
    }

    if (inactiveProductsForSale > 0) {
      addAttention(attention, "/products", {
        count: inactiveProductsForSale,
        label: `${plural(
          inactiveProductsForSale,
          "inactive product",
        )} still marked for sale`,
        href: "/products",
      });
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
      addAttention(attention, "/credits", {
        count: openCredits,
        label: `${plural(openCredits, "open credit/refund item")} need review`,
        href: "/credits",
      });
    }
  }

  if (isSuperAdminRole(session.user.role)) {
    const [
      pendingApplications,
      pendingProfileRequests,
      inactiveStaffWithCustomers,
      settings,
    ] = await Promise.all([
      prisma.staffApplication.count({
        where: { status: StaffApplicationStatus.PENDING },
      }),
      prisma.profileChangeRequest.count({
        where: { status: ProfileChangeStatus.PENDING },
      }),
      prisma.staff.count({
        where: {
          active: false,
          customers: { some: {} },
        },
      }),
      getSettings(),
    ]);

    if (pendingApplications > 0) {
      addAttention(attention, "/staff", {
        count: pendingApplications,
        label: `${plural(
          pendingApplications,
          "staff application",
        )} pending approval`,
        href: "/staff/applications",
      });
    }

    if (pendingProfileRequests > 0) {
      addAttention(attention, "/profile", {
        count: pendingProfileRequests,
        label: `${plural(
          pendingProfileRequests,
          "profile change request",
        )} pending approval`,
        href: "/profile/approvals",
      });
    }

    if (inactiveStaffWithCustomers > 0) {
      addAttention(attention, "/staff", {
        count: inactiveStaffWithCustomers,
        label: `${plural(
          inactiveStaffWithCustomers,
          "inactive staff member",
        )} still assigned customers`,
        href: "/staff",
      });
    }

    if (settings.backupDatabaseEnabled) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const backupIsOverdue =
        !settings.lastBackupAt || settings.lastBackupAt < weekAgo;

      if (backupIsOverdue) {
        addAttention(attention, "/settings", {
          count: 1,
          label: "Database backup needs review",
          href: "/settings#system",
        });
      }
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
      addAttention(attention, "/reports", {
        count: salaryBalances,
        label: `${plural(salaryBalances, "staff salary balance")} need review`,
        href: "/reports#salary-tracking",
      });
    }
  }

    return NextResponse.json({ attention });
  } catch (error) {
    console.error("NOTIFICATIONS_LOAD_ERROR", error);
    return NextResponse.json({ attention, degraded: true });
  }
}
