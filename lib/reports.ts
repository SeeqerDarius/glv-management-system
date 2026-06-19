import { AccountStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

export async function getAdminReportSummary() {
  const [
    totalCustomers,
    totalStaff,
    accounts,
    paymentAggregate,
    recentPayments,
  ] = await prisma.$transaction([
    prisma.customer.count(),
    prisma.staff.count(),
    prisma.customerAccount.findMany({
      include: {
        customer: {
          include: {
            staff: true,
          },
        },
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.findMany({
      take: 8,
      orderBy: {
        paymentDate: "desc",
      },
      include: {
        account: {
          include: {
            customer: true,
            product: true,
          },
        },
      },
    }),
  ]);

  const statusCounts = accounts.reduce(
    (totals, account) => {
      const status = getEffectiveAccountStatus(account);
      totals[status] += 1;
      return totals;
    },
    {
      [AccountStatus.ACTIVE]: 0,
      [AccountStatus.COMPLETED]: 0,
      [AccountStatus.OVERDUE]: 0,
      [AccountStatus.CANCELLED]: 0,
      [AccountStatus.SUSPENDED]: 0,
    }
  );

  const expectedReceivables = accounts.reduce((total, account) => {
    const status = getEffectiveAccountStatus(account);

    if (
      status === AccountStatus.ACTIVE ||
      status === AccountStatus.OVERDUE
    ) {
      return total + account.balance;
    }

    return total;
  }, 0);

  const profitEstimate = accounts.reduce((total, account) => {
    if (account.status === AccountStatus.CANCELLED) return total;

    return total + (account.targetAmount - account.product.costPrice);
  }, 0);

  const totalTargetAmount = accounts.reduce(
    (total, account) => total + account.targetAmount,
    0
  );

  const totalOutstandingBalance = accounts.reduce(
    (total, account) => total + account.balance,
    0
  );

  return {
    totalCustomers,
    totalStaff,
    totalAccounts: accounts.length,
    activeAccounts: statusCounts.ACTIVE,
    completedAccounts: statusCounts.COMPLETED,
    overdueAccounts: statusCounts.OVERDUE,
    cancelledAccounts: statusCounts.CANCELLED,
    suspendedAccounts: statusCounts.SUSPENDED,
    totalPaymentsCollected: paymentAggregate._sum.amount ?? 0,
    expectedReceivables,
    profitEstimate,
    totalTargetAmount,
    totalOutstandingBalance,
    recentAccounts: accounts.slice(0, 8),
    recentPayments,
  };
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
}

export async function getWeeklyStaffPerformanceReport() {
  const { start, end } = getCurrentWeekRange();
  const [staff, customers, accounts, payments] = await prisma.$transaction([
    prisma.staff.findMany({
      orderBy: {
        code: "asc",
      },
    }),
    prisma.customer.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        staffId: true,
      },
    }),
    prisma.customerAccount.findMany({
      include: {
        customer: {
          select: {
            staffId: true,
          },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        account: {
          include: {
            customer: {
              select: {
                staffId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const rows = staff.map((member) => {
    const staffCustomersAdded = customers.filter(
      (customer) => customer.staffId === member.id
    ).length;
    const staffAccounts = accounts.filter(
      (account) => account.customer.staffId === member.id
    );
    const accountsOpened = staffAccounts.filter(
      (account) => account.createdAt >= start && account.createdAt <= end
    ).length;
    const totalCollected = payments
      .filter((payment) => payment.account.customer.staffId === member.id)
      .reduce((total, payment) => total + payment.amount, 0);
    const completedAccounts = staffAccounts.filter(
      (account) => account.status === AccountStatus.COMPLETED
    ).length;
    const overdueAccounts = staffAccounts.filter(
      (account) => getEffectiveAccountStatus(account) === AccountStatus.OVERDUE
    ).length;
    const outstandingBalance = staffAccounts.reduce(
      (total, account) => total + account.balance,
      0
    );

    return {
      staffId: member.id,
      staffCode: member.code,
      staffName: member.fullName,
      customersAdded: staffCustomersAdded,
      accountsOpened,
      totalCollected,
      completedAccounts,
      overdueAccounts,
      outstandingBalance,
    };
  });

  rows.sort((a, b) => {
    if (b.totalCollected !== a.totalCollected) {
      return b.totalCollected - a.totalCollected;
    }

    if (b.accountsOpened !== a.accountsOpened) {
      return b.accountsOpened - a.accountsOpened;
    }

    return b.customersAdded - a.customersAdded;
  });

  return {
    start,
    end,
    rows: rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    })),
  };
}
