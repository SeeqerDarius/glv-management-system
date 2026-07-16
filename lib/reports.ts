import {
  AccountStatus,
  CreditSource,
  CreditStatus,
  type CustomerAccount,
} from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { refreshAccountLifecycleStatuses } from "@/lib/account-lifecycle";
import { prisma } from "@/lib/prisma";
import { getEffectiveMonthlySalary } from "@/lib/salary-history";
import { previousSalaryMonthStart, salaryMonthEnd } from "@/lib/salary-periods";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

export function getCurrentWeekRange(now = new Date()) {
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getCurrentMonthRange(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function accountCost(account: {
  product: { costPrice: number; transportCost: number };
}) {
  return account.product.costPrice + account.product.transportCost;
}

type CollectionTargetAccount = Pick<
  CustomerAccount,
  "status" | "startDate" | "expectedEndDate" | "balance" | "dailyAmount"
>;

function isExpectedForDay(
  account: CollectionTargetAccount,
  dayStart: Date,
  dayEnd: Date
) {
  const status = getEffectiveAccountStatus(account);

  if (
    account.balance <= 0 ||
    account.startDate > dayEnd ||
    (status !== AccountStatus.ACTIVE && status !== AccountStatus.OVERDUE)
  ) {
    return false;
  }

  return status === AccountStatus.OVERDUE || account.expectedEndDate >= dayStart;
}

function expectedCollectionForRange(
  accounts: CollectionTargetAccount[],
  rangeStart: Date,
  rangeEnd: Date
) {
  return accounts.reduce((total, account) => {
    const status = getEffectiveAccountStatus(account);

    if (
      account.balance <= 0 ||
      account.startDate > rangeEnd ||
      (status !== AccountStatus.ACTIVE && status !== AccountStatus.OVERDUE)
    ) {
      return total;
    }

    const activeStart =
      account.startDate > rangeStart ? account.startDate : rangeStart;
    const activeEnd =
      status === AccountStatus.OVERDUE
        ? rangeEnd
        : account.expectedEndDate < rangeEnd
          ? account.expectedEndDate
          : rangeEnd;

    if (activeEnd < activeStart) {
      return total;
    }

    const activeDays =
      Math.floor(
        (activeEnd.getTime() - activeStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    return total + account.dailyAmount * activeDays;
  }, 0);
}

export async function getAdminReportSummary() {
  await ensureStaffInventorySchema();
  await refreshAccountLifecycleStatuses();

  const month = getCurrentMonthRange();
  const salaryDueMonth = previousSalaryMonthStart();
  const salaryDueMonthEnd = salaryMonthEnd(salaryDueMonth);
  const totalCustomers = await prisma.customer.count();
  const staff = await prisma.staff.findMany({
    select: {
      monthlySalary: true,
      active: true,
      salaryHistory: { orderBy: { effectiveMonth: "asc" } },
    },
  });
  const accounts = await prisma.customerAccount.findMany({
    include: {
      customer: { include: { staff: true } },
      product: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const paymentAggregate = await prisma.payment.aggregate({
    _sum: { amount: true },
  });
  const salaryAggregate = await prisma.staffSalaryPayment.aggregate({
    where: {
      salaryMonth: {
        gte: salaryDueMonth,
        lte: salaryDueMonthEnd,
      },
    },
    _sum: { amount: true },
  });
  const recentPayments = await prisma.payment.findMany({
    take: 8,
    orderBy: { paymentDate: "desc" },
    include: { account: { include: { customer: true, product: true } } },
  });
  const openCreditAggregate = await prisma.customerCredit.aggregate({
    where: {
      status: CreditStatus.OPEN,
    },
    _count: true,
    _sum: {
      remainingAmount: true,
    },
  });
  const closureRefundCount = await prisma.customerCredit.count({
    where: {
      status: CreditStatus.OPEN,
      source: CreditSource.ACCOUNT_CLOSURE_REFUND,
    },
  });

  const statusCounts = accounts.reduce(
    (totals, account) => {
      totals[getEffectiveAccountStatus(account)] += 1;
      return totals;
    },
    {
      [AccountStatus.ACTIVE]: 0,
      [AccountStatus.COMPLETED]: 0,
      [AccountStatus.OVERDUE]: 0,
      [AccountStatus.DORMANT]: 0,
      [AccountStatus.PROBATION]: 0,
      [AccountStatus.CLOSED]: 0,
      [AccountStatus.ARCHIVED]: 0,
      [AccountStatus.CANCELLED]: 0,
      [AccountStatus.SUSPENDED]: 0,
    }
  );
  const includedAccounts = accounts.filter(
    (account) =>
      account.status !== AccountStatus.CANCELLED &&
      account.status !== AccountStatus.CLOSED &&
      account.status !== AccountStatus.ARCHIVED
  );
  const expectedReceivables = accounts
    .filter((account) => {
      const status = getEffectiveAccountStatus(account);
      return status === AccountStatus.ACTIVE || status === AccountStatus.OVERDUE;
    })
    .reduce((total, account) => total + account.balance, 0);
  const totalCollected = paymentAggregate._sum.amount ?? 0;
  const totalProductCost = includedAccounts.reduce(
    (total, account) => total + accountCost(account),
    0
  );
  const totalExpectedProfit = includedAccounts.reduce(
    (total, account) => total + account.targetAmount - accountCost(account),
    0
  );
  const totalSalaryPaid = salaryAggregate._sum.amount ?? 0;
  const currentMonthPayroll = staff
    .filter((member) => member.active)
    .reduce(
      (total, member) => total + getEffectiveMonthlySalary(member, month.start),
      0
    );
  const dueMonthPayroll = staff
    .filter((member) => member.active)
    .reduce(
      (total, member) => total + getEffectiveMonthlySalary(member, salaryDueMonth),
      0
    );
  const outstandingSalaries = Math.max(dueMonthPayroll - totalSalaryPaid, 0);
  const payrollVsIncome = totalCollected - totalSalaryPaid;
  const payrollPercentageOfRevenue =
    totalCollected > 0 ? (totalSalaryPaid / totalCollected) * 100 : 0;
  const totalMonthlySalary = staff.reduce(
    (total, member) => total + getEffectiveMonthlySalary(member, month.start),
    0
  );
  const netProfitSoFar = totalCollected - totalProductCost - totalSalaryPaid;
  const projectedNetProfit = totalExpectedProfit - currentMonthPayroll;

  return {
    totalCustomers,
    totalStaff: staff.length,
    totalAccounts: accounts.length,
    activeAccounts: statusCounts.ACTIVE,
    completedAccounts: statusCounts.COMPLETED,
    overdueAccounts: statusCounts.OVERDUE,
    dormantAccounts: statusCounts.DORMANT,
    probationAccounts: statusCounts.PROBATION,
    closedAccounts: statusCounts.CLOSED,
    archivedAccounts: statusCounts.ARCHIVED,
    cancelledAccounts: statusCounts.CANCELLED,
    suspendedAccounts: statusCounts.SUSPENDED,
    openCreditAmount: openCreditAggregate._sum.remainingAmount ?? 0,
    openCreditCount: openCreditAggregate._count,
    closureRefundCount,
    totalPaymentsCollected: totalCollected,
    expectedReceivables,
    totalOutstandingBalance: includedAccounts.reduce(
      (total, account) => total + account.balance,
      0
    ),
    totalProductCost,
    totalExpectedProfit,
    totalSalaryPaid,
    totalMonthlySalary,
    currentMonthPayroll,
    outstandingSalaries,
    payrollVsIncome,
    payrollPercentageOfRevenue,
    netProfitSoFar,
    projectedNetProfit,
    gainLossStatus:
      projectedNetProfit > 0
        ? "Projected Profit"
        : projectedNetProfit < 0
          ? "Projected Loss"
          : "Break Even",
    currentPositionStatus:
      netProfitSoFar < 0 ? "Currently Negative / Recovering Capital" : "Currently Positive",
    profitEstimate: totalExpectedProfit,
    recentAccounts: accounts.slice(0, 8),
    recentPayments,
  };
}

export async function getWeeklyStaffPerformanceReport(now = new Date()) {
  await ensureStaffInventorySchema();
  await refreshAccountLifecycleStatuses(now);

  const { start, end } = getCurrentWeekRange(now);
  const month = getCurrentMonthRange(now);
  const salaryDueMonth = previousSalaryMonthStart(now);
  const salaryDueMonthEnd = salaryMonthEnd(salaryDueMonth);
  const staff = await prisma.staff.findMany({
    orderBy: { code: "asc" },
    include: {
      salaryHistory: { orderBy: { effectiveMonth: "asc" } },
    },
  });
  const customers = await prisma.customer.findMany({
    select: { staffId: true, createdAt: true },
  });
  const accounts = await prisma.customerAccount.findMany({
    include: {
      customer: { select: { staffId: true } },
      product: true,
    },
  });
  const payments = await prisma.payment.findMany({
    include: {
      account: { include: { customer: { select: { staffId: true } } } },
    },
  });
  const salaryPayments = await prisma.staffSalaryPayment.findMany({
    orderBy: { paymentDate: "desc" },
    include: { staff: true },
  });
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { accounts: true } } },
  });
  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  const rows = staff.map((member) => {
    const memberAccounts = accounts.filter(
      (account) => account.customer.staffId === member.id
    );
    const memberPayments = payments.filter(
      (payment) => payment.account.customer.staffId === member.id
    );
    const salaryPaid = salaryPayments
      .filter(
        (payment) =>
          payment.staffId === member.id &&
          payment.salaryMonth >= salaryDueMonth &&
          payment.salaryMonth <= salaryDueMonthEnd
      )
      .reduce((total, payment) => total + payment.amount, 0);
    const expectedProfit = memberAccounts
      .filter(
        (account) =>
          account.status !== AccountStatus.CANCELLED &&
          account.status !== AccountStatus.CLOSED &&
          account.status !== AccountStatus.ARCHIVED
      )
      .reduce(
        (total, account) => total + account.targetAmount - accountCost(account),
        0
      );
    const totalCollected = memberPayments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

    const monthlySalary = getEffectiveMonthlySalary(member, salaryDueMonth);

    return {
      staffId: member.id,
      staffCode: member.code,
      staffName: member.fullName,
      assignedCustomers: customers.filter(
        (customer) => customer.staffId === member.id
      ).length,
      customersAdded: customers.filter(
        (customer) =>
          customer.staffId === member.id &&
          customer.createdAt >= start &&
          customer.createdAt <= end
      ).length,
      activeAccounts: memberAccounts.filter(
        (account) => getEffectiveAccountStatus(account) === AccountStatus.ACTIVE
      ).length,
      completedAccounts: memberAccounts.filter(
        (account) => account.status === AccountStatus.COMPLETED
      ).length,
      accountsOpened: memberAccounts.filter(
        (account) => account.createdAt >= start && account.createdAt <= end
      ).length,
      totalContractValue: memberAccounts
        .filter(
          (account) =>
            account.status !== AccountStatus.CLOSED &&
            account.status !== AccountStatus.ARCHIVED
        )
        .reduce(
        (total, account) => total + account.targetAmount,
        0
      ),
      totalCollected,
      outstandingBalance: memberAccounts
        .filter(
          (account) =>
            account.status !== AccountStatus.CLOSED &&
            account.status !== AccountStatus.ARCHIVED
        )
        .reduce(
        (total, account) => total + account.balance,
        0
      ),
      weeklyCollection: memberPayments
        .filter(
          (payment) => payment.paymentDate >= start && payment.paymentDate <= end
        )
        .reduce((total, payment) => total + payment.amount, 0),
      monthlyCollection: memberPayments
        .filter(
          (payment) =>
            payment.paymentDate >= month.start && payment.paymentDate <= month.end
        )
        .reduce((total, payment) => total + payment.amount, 0),
      expectedTotalCollection: memberAccounts
        .filter(
          (account) =>
            account.status !== AccountStatus.CLOSED &&
            account.status !== AccountStatus.ARCHIVED
        )
        .reduce(
        (total, account) => total + account.targetAmount,
        0
      ),
      salaryPaid,
      monthlySalary,
      salaryPaidThisMonth: salaryPaid,
      salaryBalanceThisMonth: Math.max(monthlySalary - salaryPaid, 0),
      netPosition: totalCollected - salaryPaid,
      expectedProfit,
      projectedProfitAfterSalary: expectedProfit - monthlySalary,
      overdueAccounts: memberAccounts.filter(
        (account) => getEffectiveAccountStatus(account) === AccountStatus.OVERDUE
      ).length,
    };
  });

  rows.sort(
    (a, b) =>
      b.weeklyCollection - a.weeklyCollection ||
      b.totalCollected - a.totalCollected ||
      b.accountsOpened - a.accountsOpened
  );

  const totalCollected = payments.reduce((total, payment) => total + payment.amount, 0);
  const totalSalaryPaid = salaryPayments.reduce(
    (total, payment) =>
      payment.salaryMonth >= salaryDueMonth &&
      payment.salaryMonth <= salaryDueMonthEnd
        ? total + payment.amount
        : total,
    0
  );
  const totalSalariesPaid = salaryPayments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  const currentMonthPayroll = staff
    .filter((member) => member.active)
    .reduce(
      (total, member) => total + getEffectiveMonthlySalary(member, month.start),
      0
    );
  const dueMonthPayroll = staff
    .filter((member) => member.active)
    .reduce(
      (total, member) =>
        total + getEffectiveMonthlySalary(member, salaryDueMonth),
      0
    );
  const totalMonthlySalary = staff.reduce(
    (total, member) => total + getEffectiveMonthlySalary(member, month.start),
    0
  );
  const includedAccounts = accounts.filter(
    (account) =>
      account.status !== AccountStatus.CANCELLED &&
      account.status !== AccountStatus.CLOSED &&
      account.status !== AccountStatus.ARCHIVED
  );
  const totalProductCost = includedAccounts.reduce(
    (total, account) => total + accountCost(account),
    0
  );
  const totalExpectedProfit = includedAccounts.reduce(
    (total, account) => total + account.targetAmount - accountCost(account),
    0
  );
  const projectedNetProfit = totalExpectedProfit - currentMonthPayroll;
  const monthlyIncome = payments
    .filter(
      (payment) =>
        payment.paymentDate >= month.start && payment.paymentDate <= month.end
    )
    .reduce((total, payment) => total + payment.amount, 0);
  const outstandingSalaries = Math.max(dueMonthPayroll - totalSalaryPaid, 0);
  const payrollVsIncome = monthlyIncome - totalSalaryPaid;
  const payrollPercentageOfRevenue =
    monthlyIncome > 0 ? (totalSalaryPaid / monthlyIncome) * 100 : 0;
  const userNames = new Map(users.map((user) => [user.id, user.name]));

  return {
    start,
    end,
    rows: rows.map((row, index) => ({ ...row, rank: index + 1 })),
    products: products.map((product) => {
      const layawayProfit =
        product.layawayPrice - product.costPrice - product.transportCost;
      const accountCount = product._count.accounts;
      return {
        ...product,
        accountCount,
        layawayProfit,
        layawayProfitPercentage:
          product.costPrice > 0 ? (layawayProfit / product.costPrice) * 100 : 0,
        expectedLayawayRevenue: product.layawayPrice * accountCount,
        expectedLayawayProfit: layawayProfit * accountCount,
      };
    }),
    salaryPayments: salaryPayments.map((payment) => ({
      ...payment,
      paidByName: userNames.get(payment.paidBy) ?? "System User",
    })),
    summary: {
      totalExpectedReceivables: accounts
        .filter((account) => {
          const status = getEffectiveAccountStatus(account);
          return status === AccountStatus.ACTIVE || status === AccountStatus.OVERDUE;
        })
        .reduce((total, account) => total + account.balance, 0),
      totalCollected,
      totalOutstandingBalance: includedAccounts.reduce(
        (total, account) => total + account.balance,
        0
      ),
      totalProductCost,
      totalExpectedProfit,
      totalSalaryPaid,
      totalSalariesPaid,
      totalMonthlySalary,
      currentMonthPayroll,
      outstandingSalaries,
      payrollVsIncome,
      payrollPercentageOfRevenue,
      monthlyIncome,
      netProfitSoFar: totalCollected - totalProductCost - totalSalaryPaid,
      projectedNetProfit,
      gainLossStatus:
        projectedNetProfit > 0
          ? "Projected Profit"
          : projectedNetProfit < 0
            ? "Projected Loss"
            : "Break Even",
    },
  };
}

export async function getStaffDashboardSummary(staffId: string, now = new Date()) {
  await refreshAccountLifecycleStatuses(now);

  const week = getCurrentWeekRange(now);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);
  const staff = await prisma.staff.findUnique({
    where: {
      id: staffId,
    },
  });

  if (!staff) {
    return null;
  }

  const customers = await prisma.customer.findMany({
    where: {
      staffId,
    },
    include: {
      accounts: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const accounts = customers.flatMap((customer) => customer.accounts);
  const scopedPaymentWhere = {
    account: {
      customer: {
        staffId,
      },
    },
  };
  const [
    paymentsRecordedToday,
    collectedToday,
    collectedThisWeek,
    recentPayments,
  ] = await Promise.all([
    prisma.payment.count({
      where: {
        paymentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...scopedPaymentWhere,
      },
    }),
    prisma.payment.aggregate({
      where: {
        paymentDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        ...scopedPaymentWhere,
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.aggregate({
      where: {
        paymentDate: {
          gte: week.start,
          lte: week.end,
        },
        ...scopedPaymentWhere,
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.findMany({
      take: 5,
      where: {
        ...scopedPaymentWhere,
      },
      orderBy: {
        paymentDate: "desc",
      },
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        paymentDate: true,
        method: true,
        account: {
          select: {
            id: true,
            product: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
            customer: {
              select: {
                id: true,
                fullName: true,
                customerId: true,
              },
            },
          },
        },
      },
    }),
  ]);
  const statusCounts = accounts.reduce(
    (totals, account) => {
      totals[getEffectiveAccountStatus(account)] += 1;
      return totals;
    },
    {
      [AccountStatus.ACTIVE]: 0,
      [AccountStatus.COMPLETED]: 0,
      [AccountStatus.OVERDUE]: 0,
      [AccountStatus.DORMANT]: 0,
      [AccountStatus.PROBATION]: 0,
      [AccountStatus.CLOSED]: 0,
      [AccountStatus.ARCHIVED]: 0,
      [AccountStatus.CANCELLED]: 0,
      [AccountStatus.SUSPENDED]: 0,
    }
  );

  return {
    staff,
    totalCustomers: customers.length,
    totalAccounts: accounts.length,
    activeAccounts: statusCounts.ACTIVE,
    completedAccounts: statusCounts.COMPLETED,
    overdueAccounts: statusCounts.OVERDUE,
    dormantAccounts: statusCounts.DORMANT,
    probationAccounts: statusCounts.PROBATION,
    closedAccounts: statusCounts.CLOSED,
    archivedAccounts: statusCounts.ARCHIVED,
    cancelledAccounts: statusCounts.CANCELLED,
    suspendedAccounts: statusCounts.SUSPENDED,
    paymentsRecordedToday,
    totalCollectedToday: collectedToday._sum.amount ?? 0,
    totalCollectedThisWeek: collectedThisWeek._sum.amount ?? 0,
    accountsOpenedThisWeek: accounts.filter(
      (account) => account.createdAt >= week.start && account.createdAt <= week.end
    ).length,
    customersAddedThisWeek: customers.filter(
      (customer) => customer.createdAt >= week.start && customer.createdAt <= week.end
    ).length,
    recentCustomers: customers.slice(0, 5),
    recentPayments,
  };
}

export async function getActivityReport({
  staffId,
  includeFinancialValues = true,
  now = new Date(),
}: {
  staffId?: string | null;
  includeFinancialValues?: boolean;
  now?: Date;
}) {
  await ensureStaffInventorySchema();
  await refreshAccountLifecycleStatuses(now);

  const week = getCurrentWeekRange(now);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const scopedCustomerWhere = staffId ? { staffId } : {};
  const scopedAccountWhere = staffId
    ? {
        customer: {
          staffId,
        },
      }
    : {};

  const [customers, accounts, payments, staff] = await Promise.all([
    prisma.customer.findMany({
      where: scopedCustomerWhere,
      select: {
        id: true,
        staffId: true,
        createdAt: true,
      },
    }),
    prisma.customerAccount.findMany({
      where: scopedAccountWhere,
      include: {
        customer: {
          include: {
            staff: true,
          },
        },
        product: true,
      },
    }),
    prisma.payment.findMany({
      where: staffId
        ? {
            account: {
              customer: {
                staffId,
              },
            },
          }
        : {},
      include: {
        account: {
          include: {
            customer: {
              include: {
                staff: true,
              },
            },
            product: true,
          },
        },
      },
      orderBy: {
        paymentDate: "desc",
      },
    }),
    prisma.staff.findMany({
      orderBy: {
        code: "asc",
      },
    }),
  ]);

  const weeklyPayments = dayLabels.map((label, index) => {
    const dayStart = new Date(week.start);
    dayStart.setDate(week.start.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const expectedAmount = includeFinancialValues
      ? accounts
          .filter((account) => isExpectedForDay(account, dayStart, dayEnd))
          .reduce((total, account) => total + account.dailyAmount, 0)
      : 0;
    const dayPayments = payments.filter(
      (payment) =>
        payment.paymentDate >= dayStart && payment.paymentDate <= dayEnd
    );
    const amount = includeFinancialValues
      ? dayPayments.reduce((total, payment) => total + payment.amount, 0)
      : 0;

    return {
      label,
      amount,
      expectedAmount,
      count: dayPayments.length,
    };
  });

  const totalAccountCount = Math.max(accounts.length, 1);

  const accountStatus = Object.values(AccountStatus).map((status) => ({
    status,
    count: accounts.filter((account) => getEffectiveAccountStatus(account) === status)
      .length,
  }));

  const staffPerformance = staff
    .filter((member) => !staffId || member.id === staffId)
    .map((member) => {
      const memberPayments = payments.filter(
        (payment) => payment.account.customer.staffId === member.id
      );
      const memberWeeklyPayments = memberPayments.filter(
        (payment) =>
          payment.paymentDate >= week.start && payment.paymentDate <= week.end
      );
      const memberAccounts = accounts.filter(
        (account) => account.customer.staffId === member.id
      );
      const expectedWeeklyCollection = includeFinancialValues
        ? expectedCollectionForRange(memberAccounts, week.start, week.end)
        : 0;
      return {
        staffId: member.id,
        staffCode: member.code,
        staffName: member.fullName,
        customers: customers.filter((customer) => customer.staffId === member.id).length,
        accounts: memberAccounts.length,
        collected: includeFinancialValues
          ? memberWeeklyPayments.reduce(
              (total, payment) => total + payment.amount,
              0
            )
          : null,
        expectedWeeklyCollection,
        outstanding: includeFinancialValues
          ? memberAccounts
              .filter(
                (account) =>
                  account.status !== AccountStatus.CLOSED &&
                  account.status !== AccountStatus.ARCHIVED
              )
              .reduce((total, account) => total + account.balance, 0)
          : null,
      };
    })
    .sort((a, b) => (b.collected ?? 0) - (a.collected ?? 0));

  return {
    start: week.start,
    end: week.end,
    weeklyPayments,
    accountStatus: accountStatus.map((status) => ({
      ...status,
      total: totalAccountCount,
    })),
    staffPerformance,
    recentPayments: payments.slice(0, 8),
  };
}
