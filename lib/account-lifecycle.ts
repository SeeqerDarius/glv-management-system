import {
  AccountStatus,
  CreditSource,
  CreditStatus,
  DeliveryStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAccountDocument } from "@/lib/customer-documents";
import { LEGAL_TEMPLATE_KEYS } from "@/lib/legal-templates";
import { formatMoney } from "@/lib/accounts";
import {
  ARCHIVE_AFTER_DELIVERY_DAYS,
  addDays,
  getAccountActivityDate,
  getClosureRefundAmounts,
  getNextLifecycleStatus,
} from "@/lib/account-lifecycle-rules";

// The lifecycle rules are re-exported so callers keep a single import site.
export {
  DORMANT_REACTIVATION_SERVICE_FEE_RATE,
  getAccountActivityDate,
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  getDormantReactivationCutoffDate,
  getNextLifecycleStatus,
  isDormantReactivationEligible,
} from "@/lib/account-lifecycle-rules";

export async function refreshAccountLifecycleStatuses(now = new Date()) {
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

      // A customer already holding the product is not owed a closure refund.
      // What remains on such an account is a receivable, not a deposit.
      const alreadyHoldsProduct =
        account.deliveryStatus === DeliveryStatus.DELIVERED;

      if (
        nextStatus === AccountStatus.CLOSED &&
        !alreadyHoldsProduct &&
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
            lastActivityDate: getAccountActivityDate(account),
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

    if (
      nextStatus === AccountStatus.CLOSED &&
      account.deliveryStatus !== DeliveryStatus.DELIVERED
    ) {
      const { refundAmount, serviceFee, serviceFeeRate } =
        getClosureRefundAmounts(account.totalPaid);
      await createAccountDocument({
        accountId: account.id,
        templateKey: LEGAL_TEMPLATE_KEYS.CANCELLATION,
        type: "ACCOUNT_CLOSURE_CALCULATION",
        createdBy: "system",
        dedupeBase: `ACCOUNT_CLOSURE_CALCULATION:${account.id}`,
        values: {
          deductionRate: `${Math.round(serviceFeeRate * 100)}%`,
          deductionAmount: formatMoney(serviceFee),
          refundAmount: formatMoney(refundAmount),
          refundMethod: "Customer credit / approved payment channel",
          processingTime: "Subject to identity and account verification",
        },
      }).catch((error) =>
        console.error("QUEUE_CLOSURE_CALCULATION_ERROR", error)
      );
    }
  }
}
