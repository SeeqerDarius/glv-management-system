import {
  AccountStatus,
  CreditSource,
  CreditStatus,
  DeliveryStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

const DORMANT_AFTER_DAYS = 21;
const PROBATION_AFTER_MONTHS = 4;
const CLOSE_AFTER_MONTHS = 6;
const ARCHIVE_AFTER_DELIVERY_DAYS = 2;
const CLOSURE_SERVICE_FEE_RATE = 0.32;
export const DORMANT_REACTIVATION_SERVICE_FEE_RATE = 0.32;

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

export function getDormantReactivationCutoffDate(account: {
  startDate: Date;
  payments: Array<{ paymentDate: Date }>;
}) {
  const lastActivityDate = account.payments[0]?.paymentDate ?? account.startDate;
  return addMonths(lastActivityDate, CLOSE_AFTER_MONTHS);
}

export function isDormantReactivationEligible(
  account: {
    status: AccountStatus;
    startDate: Date;
    payments: Array<{ paymentDate: Date }>;
  },
  now = new Date()
) {
  return (
    (account.status === AccountStatus.DORMANT ||
      account.status === AccountStatus.PROBATION ||
      account.status === AccountStatus.CLOSED) &&
    now >= getDormantReactivationCutoffDate(account)
  );
}

export function getDormantReactivationAmounts(totalPaid: number) {
  const serviceFee = Math.max(totalPaid, 0) * DORMANT_REACTIVATION_SERVICE_FEE_RATE;
  const nextTotalPaid = Math.max(totalPaid - serviceFee, 0);

  return {
    serviceFee,
    nextTotalPaid,
    serviceFeeRate: DORMANT_REACTIVATION_SERVICE_FEE_RATE,
  };
}

function getNextLifecycleStatus(account: LifecycleAccount, now: Date) {
  if (
    account.status === AccountStatus.COMPLETED ||
    account.status === AccountStatus.CANCELLED ||
    account.status === AccountStatus.SUSPENDED ||
    account.status === AccountStatus.CLOSED ||
    account.status === AccountStatus.ARCHIVED ||
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
  await ensureStaffInventorySchema();

  const archiveCutoff = addDays(now, -ARCHIVE_AFTER_DELIVERY_DAYS);
  const deliveredCompletedAccounts = await prisma.customerAccount.findMany({
    where: {
      status: AccountStatus.COMPLETED,
      deliveryStatus: DeliveryStatus.DELIVERED,
      deliveredAt: {
        lte: archiveCutoff,
      },
    },
    select: {
      id: true,
      deliveredAt: true,
      deliveredBy: true,
      customerId: true,
      productId: true,
    },
  });

  for (const account of deliveredCompletedAccounts) {
    await prisma.$transaction(async (tx) => {
      await tx.customerAccount.update({
        where: {
          id: account.id,
        },
        data: {
          status: AccountStatus.ARCHIVED,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: "system",
          action: "ARCHIVE_DELIVERED_ACCOUNT",
          entity: "CustomerAccount",
          entityId: account.id,
          oldValue: JSON.stringify({
            status: AccountStatus.COMPLETED,
            deliveredAt: account.deliveredAt,
            deliveredBy: account.deliveredBy,
          }),
          newValue: JSON.stringify({
            status: AccountStatus.ARCHIVED,
            archivedAfterDeliveryDays: ARCHIVE_AFTER_DELIVERY_DAYS,
            customerId: account.customerId,
            productId: account.productId,
          }),
        },
      });
    });
  }

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
