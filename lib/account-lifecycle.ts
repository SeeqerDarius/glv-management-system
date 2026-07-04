import {
  AccountStatus,
  CreditSource,
  CreditStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DORMANT_AFTER_DAYS = 21;
const PROBATION_AFTER_MONTHS = 4;
const CLOSE_AFTER_MONTHS = 6;
const CLOSURE_SERVICE_FEE_RATE = 0.32;

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

type LifecycleAccount = Prisma.CustomerAccountGetPayload<{
  include: {
    payments: {
      orderBy: { paymentDate: "desc" };
      take: 1;
    };
    credits: {
      where: {
        source: typeof CreditSource.ACCOUNT_CLOSURE_REFUND;
        status: { not: typeof CreditStatus.VOID };
      };
    };
  };
}>;

function getLastActivityDate(account: LifecycleAccount) {
  return account.payments[0]?.paymentDate ?? account.startDate;
}

function getNextLifecycleStatus(account: LifecycleAccount, now: Date) {
  if (
    account.status === AccountStatus.COMPLETED ||
    account.status === AccountStatus.CANCELLED ||
    account.status === AccountStatus.SUSPENDED ||
    account.status === AccountStatus.CLOSED ||
    account.balance <= 0
  ) {
    return account.status;
  }

  const lastActivityDate = getLastActivityDate(account);

  if (now >= addMonths(lastActivityDate, CLOSE_AFTER_MONTHS)) {
    return AccountStatus.CLOSED;
  }

  if (now >= addMonths(lastActivityDate, PROBATION_AFTER_MONTHS)) {
    return AccountStatus.PROBATION;
  }

  if (now >= addDays(lastActivityDate, DORMANT_AFTER_DAYS)) {
    return AccountStatus.DORMANT;
  }

  return AccountStatus.ACTIVE;
}

export function getClosureRefundAmounts(totalPaid: number) {
  const serviceFee = totalPaid * CLOSURE_SERVICE_FEE_RATE;
  const refundAmount = Math.max(totalPaid - serviceFee, 0);

  return {
    refundAmount,
    serviceFee,
    serviceFeeRate: CLOSURE_SERVICE_FEE_RATE,
  };
}

export async function refreshAccountLifecycleStatuses(now = new Date()) {
  const accounts = await prisma.customerAccount.findMany({
    where: {
      balance: {
        gt: 0,
      },
      status: {
        in: [
          AccountStatus.ACTIVE,
          AccountStatus.OVERDUE,
          AccountStatus.DORMANT,
          AccountStatus.PROBATION,
        ],
      },
    },
    include: {
      payments: {
        orderBy: {
          paymentDate: "desc",
        },
        take: 1,
      },
      credits: {
        where: {
          source: CreditSource.ACCOUNT_CLOSURE_REFUND,
          status: {
            not: CreditStatus.VOID,
          },
        },
      },
    },
  });

  for (const account of accounts) {
    const nextStatus = getNextLifecycleStatus(account, now);

    if (nextStatus === account.status) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerAccount.update({
        where: {
          id: account.id,
        },
        data: {
          status: nextStatus,
        },
      });

      let closureCreditId: string | null = null;
      let closureRefundAmount = 0;
      let closureServiceFee = 0;

      if (
        nextStatus === AccountStatus.CLOSED &&
        account.totalPaid > 0 &&
        account.credits.length === 0
      ) {
        const { refundAmount, serviceFee, serviceFeeRate } =
          getClosureRefundAmounts(account.totalPaid);

        if (refundAmount > 0) {
          const credit = await tx.customerCredit.create({
            data: {
              customerId: account.customerId,
              accountId: account.id,
              amount: refundAmount,
              remainingAmount: refundAmount,
              status: CreditStatus.OPEN,
              source: CreditSource.ACCOUNT_CLOSURE_REFUND,
              notes: `Account closed after inactivity. Service fee deducted: ${Math.round(serviceFeeRate * 100)}%.`,
              createdBy: "system",
            },
          });

          closureCreditId = credit.id;
          closureRefundAmount = refundAmount;
          closureServiceFee = serviceFee;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: "system",
          action: "UPDATE_ACCOUNT_LIFECYCLE_STATUS",
          entity: "CustomerAccount",
          entityId: account.id,
          oldValue: JSON.stringify({
            status: account.status,
            lastActivityDate: getLastActivityDate(account),
          }),
          newValue: JSON.stringify({
            status: nextStatus,
            closureCreditId,
            closureRefundAmount,
            closureServiceFee,
          }),
        },
      });
    });
  }
}
