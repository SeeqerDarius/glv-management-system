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
  ] = await Promise.all([
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
