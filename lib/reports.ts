import { AccountStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

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

export async function getAdminReportSummary() {
  const month = getCurrentMonthRange();
  const totalCustomers = await prisma.customer.count();
  const staff = await prisma.staff.findMany({
    select: { monthlySalary: true, active: true },
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
      paymentDate: {
        gte: month.start,
        lte: month.end,
      },
    },
    _sum: { amount: true },
  });
  const recentPayments = await prisma.payment.findMany({
    take: 8,
    orderBy: { paymentDate: "desc" },
    include: { account: { include: { customer: true, product: true } } },
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
      [AccountStatus.CANCELLED]: 0,
      [AccountStatus.SUSPENDED]: 0,
    }
  );
  const includedAccounts = accounts.filter(
    (account) => account.status !== AccountStatus.CANCELLED
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
      (total, member) => total + member.monthlySalary,
      0
    );
  const outstandingSalaries = Math.max(
    currentMonthPayroll - totalSalaryPaid,
    0
  );
  const payrollVsIncome = totalCollected - totalSalaryPaid;
  const payrollPercentageOfRevenue =
    totalCollected > 0 ? (totalSalaryPaid / totalCollected) * 100 : 0;
  const totalMonthlySalary = staff.reduce(
    (total, member) => total + member.monthlySalary,
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
    cancelledAccounts: statusCounts.CANCELLED,
    suspendedAccounts: statusCounts.SUSPENDED,
    totalPaymentsCollected: totalCollected,
    expectedReceivables,
    totalOutstandingBalance: accounts.reduce(
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
  const { start, end } = getCurrentWeekRange(now);
  const month = getCurrentMonthRange(now);
  const staff = await prisma.staff.findMany({ orderBy: { code: "asc" } });
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
          payment.paymentDate >= month.start &&
          payment.paymentDate <= month.end
      )
      .reduce((total, payment) => total + payment.amount, 0);
    const expectedProfit = memberAccounts
      .filter((account) => account.status !== AccountStatus.CANCELLED)
      .reduce(
        (total, account) => total + account.targetAmount - accountCost(account),
        0
      );
    const totalCollected = memberPayments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

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
      totalContractValue: memberAccounts.reduce(
        (total, account) => total + account.targetAmount,
        0
      ),
      totalCollected,
      outstandingBalance: memberAccounts.reduce(
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
      expectedTotalCollection: memberAccounts.reduce(
        (total, account) => total + account.targetAmount,
        0
      ),
      salaryPaid,
      monthlySalary: member.monthlySalary,
      salaryPaidThisMonth: salaryPaid,
      salaryBalanceThisMonth: Math.max(member.monthlySalary - salaryPaid, 0),
      netPosition: totalCollected - salaryPaid,
      expectedProfit,
      projectedProfitAfterSalary: expectedProfit - member.monthlySalary,
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
      payment.paymentDate >= month.start && payment.paymentDate <= month.end
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
      (total, member) => total + member.monthlySalary,
      0
    );
  const totalMonthlySalary = staff.reduce(
    (total, member) => total + member.monthlySalary,
    0
  );
  const includedAccounts = accounts.filter(
    (account) => account.status !== AccountStatus.CANCELLED
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
  const outstandingSalaries = Math.max(currentMonthPayroll - totalSalaryPaid, 0);
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
      totalOutstandingBalance: accounts.reduce(
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
