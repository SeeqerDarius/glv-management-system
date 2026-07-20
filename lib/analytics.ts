import { AccountStatus, CreditStatus, DeliveryStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { getProcurementList } from "@/lib/procurement";
import { prisma } from "@/lib/prisma";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

const activeAccountStatuses: AccountStatus[] = [
  AccountStatus.ACTIVE,
  AccountStatus.OVERDUE,
  AccountStatus.DORMANT,
  AccountStatus.PROBATION,
  AccountStatus.SUSPENDED,
];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function weekStart(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export async function getAnalyticsSummary(now = new Date()) {
  await ensureStaffInventorySchema();

  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  const firstTrendWeek = addDays(weekStart(now), -49);

  const [
    customers,
    accounts,
    payments,
    openCredits,
    products,
    staffInventory,
    procurement,
  ] = await Promise.all([
    prisma.customer.findMany({
      select: {
        id: true,
        createdAt: true,
        staff: {
          select: {
            id: true,
            code: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.customerAccount.findMany({
      select: {
        id: true,
        targetAmount: true,
        totalPaid: true,
        balance: true,
        status: true,
        deliveryStatus: true,
        createdAt: true,
        expectedEndDate: true,
        customer: {
          select: {
            staff: {
              select: {
                id: true,
                code: true,
                fullName: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            costPrice: true,
            layawayPrice: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: firstTrendWeek,
        },
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        account: {
          select: {
            customer: {
              select: {
                staff: {
                  select: {
                    id: true,
                    code: true,
                    fullName: true,
                  },
                },
              },
            },
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: "asc",
      },
    }),
    prisma.customerCredit.aggregate({
      where: {
        status: CreditStatus.OPEN,
      },
      _sum: {
        remainingAmount: true,
      },
      _count: true,
    }),
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        active: true,
        quantityOnSale: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.staffInventory.findMany({
      select: {
        quantity: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        staff: {
          select: {
            id: true,
            code: true,
            fullName: true,
          },
        },
      },
      orderBy: [
        {
          staff: {
            fullName: "asc",
          },
        },
        {
          product: {
            name: "asc",
          },
        },
      ],
    }),
    getProcurementList(),
  ]);

  const effectiveAccounts = accounts.map((account) => ({
    ...account,
    effectiveStatus: getEffectiveAccountStatus(account),
  }));
  const totalPaid = accounts.reduce((total, account) => total + account.totalPaid, 0);
  const totalTarget = accounts.reduce(
    (total, account) => total + account.targetAmount,
    0
  );
  const outstandingBalance = effectiveAccounts
    .filter((account) => activeAccountStatuses.includes(account.effectiveStatus))
    .reduce((total, account) => total + Math.max(account.balance, 0), 0);
  const activeAccounts = effectiveAccounts.filter((account) =>
    activeAccountStatuses.includes(account.effectiveStatus)
  );
  const completedAccounts = effectiveAccounts.filter(
    (account) => account.effectiveStatus === AccountStatus.COMPLETED
  );
  const overdueAccounts = effectiveAccounts.filter(
    (account) => account.effectiveStatus === AccountStatus.OVERDUE
  );
  const pendingDeliveryAccounts = effectiveAccounts.filter(
    (account) =>
      account.deliveryStatus === DeliveryStatus.PENDING &&
      account.totalPaid >= account.targetAmount
  );

  const collectedToday = payments
    .filter((payment) => payment.paymentDate >= today)
    .reduce((total, payment) => total + payment.amount, 0);
  const collectedThisMonth = payments
    .filter((payment) => payment.paymentDate >= monthStart)
    .reduce((total, payment) => total + payment.amount, 0);
  const newCustomersThisMonth = customers.filter(
    (customer) => customer.createdAt >= monthStart
  ).length;
  const newAccountsThisMonth = accounts.filter(
    (account) => account.createdAt >= monthStart
  ).length;

  const trendWeeks = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(firstTrendWeek, index * 7);
    const end = addDays(start, 7);
    const amount = payments
      .filter(
        (payment) => payment.paymentDate >= start && payment.paymentDate < end
      )
      .reduce((total, payment) => total + payment.amount, 0);

    return {
      label: `${formatWeekLabel(start)} - ${formatWeekLabel(addDays(end, -1))}`,
      amount,
    };
  });

  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      category: string;
      accounts: number;
      activeAccounts: number;
      completedAccounts: number;
      totalPaid: number;
      outstandingBalance: number;
    }
  >();

  for (const account of effectiveAccounts) {
    const existing =
      productMap.get(account.product.id) ??
      {
        productId: account.product.id,
        productName: account.product.name,
        category: account.product.category,
        accounts: 0,
        activeAccounts: 0,
        completedAccounts: 0,
        totalPaid: 0,
        outstandingBalance: 0,
      };

    existing.accounts += 1;
    existing.totalPaid += account.totalPaid;

    if (activeAccountStatuses.includes(account.effectiveStatus)) {
      existing.activeAccounts += 1;
      existing.outstandingBalance += Math.max(account.balance, 0);
    }

    if (account.effectiveStatus === AccountStatus.COMPLETED) {
      existing.completedAccounts += 1;
    }

    productMap.set(account.product.id, existing);
  }

  const staffMap = new Map<
    string,
    {
      staffId: string;
      staffName: string;
      staffCode: string;
      customers: number;
      accounts: number;
      activeAccounts: number;
      overdueAccounts: number;
      collected: number;
      outstandingBalance: number;
    }
  >();

  function ensureStaff(staff: { id: string; code: string; fullName: string }) {
    const existing =
      staffMap.get(staff.id) ??
      {
        staffId: staff.id,
        staffName: staff.fullName,
        staffCode: staff.code,
        customers: 0,
        accounts: 0,
        activeAccounts: 0,
        overdueAccounts: 0,
        collected: 0,
        outstandingBalance: 0,
      };

    staffMap.set(staff.id, existing);
    return existing;
  }

  for (const customer of customers) {
    ensureStaff(customer.staff).customers += 1;
  }

  for (const account of effectiveAccounts) {
    const staff = ensureStaff(account.customer.staff);
    staff.accounts += 1;

    if (activeAccountStatuses.includes(account.effectiveStatus)) {
      staff.activeAccounts += 1;
      staff.outstandingBalance += Math.max(account.balance, 0);
    }

    if (account.effectiveStatus === AccountStatus.OVERDUE) {
      staff.overdueAccounts += 1;
    }
  }

  for (const payment of payments) {
    ensureStaff(payment.account.customer.staff).collected += payment.amount;
  }

  const productPerformance = Array.from(productMap.values()).sort(
    (a, b) =>
      b.accounts - a.accounts ||
      b.totalPaid - a.totalPaid ||
      a.productName.localeCompare(b.productName)
  );
  const staffPerformance = Array.from(staffMap.values()).sort((a, b) =>
    a.staffName.localeCompare(b.staffName)
  );
  const zeroStockItems = staffInventory.filter((item) => item.quantity <= 0);
  const lowStockItems = staffInventory.filter(
    (item) => item.quantity > 0 && item.quantity <= 2
  );

  return {
    totals: {
      customers: customers.length,
      products: products.length,
      activeProducts: products.filter((product) => product.active).length,
      accounts: accounts.length,
      activeAccounts: activeAccounts.length,
      completedAccounts: completedAccounts.length,
      overdueAccounts: overdueAccounts.length,
      pendingDeliveryAccounts: pendingDeliveryAccounts.length,
      totalPaid,
      totalTarget,
      outstandingBalance,
      collectedToday,
      collectedThisMonth,
      newCustomersThisMonth,
      newAccountsThisMonth,
      openCreditCount: openCredits._count,
      openCreditAmount: openCredits._sum.remainingAmount ?? 0,
      collectionProgress: percentage(totalPaid, totalTarget),
    },
    collectionTrend: trendWeeks,
    productPerformance: productPerformance.slice(0, 10),
    staffPerformance: staffPerformance.slice(0, 12),
    procurement: {
      thresholdPercent: procurement.thresholdPercent,
      totalQuantity: procurement.totalQuantity,
      totalCost: procurement.totalCost,
      items: procurement.items.slice(0, 8),
    },
    inventory: {
      totalAllocated: staffInventory.reduce(
        (total, item) => total + Math.max(item.quantity, 0),
        0
      ),
      zeroStockCount: zeroStockItems.length,
      lowStockCount: lowStockItems.length,
      zeroStockItems: zeroStockItems.slice(0, 8),
      lowStockItems: lowStockItems.slice(0, 8),
    },
  };
}
