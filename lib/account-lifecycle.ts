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
  getArchiveRepairStatus,
  getClosureRefundAmounts,
  getNextLifecycleStatus,
} from "@/lib/account-lifecycle-rules";

// The lifecycle rules are re-exported so callers keep a single import site.
export {
  DORMANT_REACTIVATION_SERVICE_FEE_RATE,
  getAccountActivityDate,
  getArchiveRepairStatus,
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  getDormantReactivationCutoffDate,
  getNextLifecycleStatus,
  getStatusAfterBalanceChange,
  isAwaitingDelivery,
  isDormantReactivationEligible,
  isFinishedStatus,
} from "@/lib/account-lifecycle-rules";

/**
 * Puts archived accounts that no longer meet the archive rule back on the
 * working list. The archive only ever holds plans that are paid off and
 * delivered, but older data breaks that: the weekly-report recovery import
 * brought archived plans in as "pending delivery", and reversing a delivery or
 * deleting a payment on an archived plan used to leave it there. Nothing can
 * be done to an archived account, so such a plan was stuck: its delivery could
 * not be confirmed and it dropped out of every delivery queue.
 */
async function restoreMisfiledArchivedAccounts() {
  const misfiled = await prisma.customerAccount.findMany({
    where: {
      status: AccountStatus.ARCHIVED,
      OR: [
        { deliveryStatus: { not: DeliveryStatus.DELIVERED } },
        { balance: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      status: true,
      balance: true,
      deliveryStatus: true,
    },
  });

  for (const account of misfiled) {
    const nextStatus = getArchiveRepairStatus(account);

    if (!nextStatus) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // Conditional, so a sweep running in parallel cannot restore it twice.
      const { count } = await tx.customerAccount.updateMany({
        where: { id: account.id, status: AccountStatus.ARCHIVED },
        data: { status: nextStatus },
      });

      if (count === 0) {
        return;
      }

      await tx.auditLog.create({
        data: {
          userId: "system",
          action: "RESTORE_ARCHIVED_ACCOUNT",
          entity: "CustomerAccount",
          entityId: account.id,
          oldValue: JSON.stringify({
            status: account.status,
            balance: account.balance,
            deliveryStatus: account.deliveryStatus,
          }),
          newValue: JSON.stringify({
            status: nextStatus,
            reason:
              account.balance > 0
                ? "Archived account owes a balance, so it is back in collection."
                : "Archived account was never marked delivered, so it is back in the delivery queue.",
          }),
        },
      });
    });
  }
}

export async function refreshAccountLifecycleStatuses(now = new Date()) {
  await restoreMisfiledArchivedAccounts();

  const archiveCutoff = addDays(now, -ARCHIVE_AFTER_DELIVERY_DAYS);
  const deliveredCompletedAccounts = await prisma.customerAccount.findMany({
    where: {
      status: AccountStatus.COMPLETED,
      balance: {
        lte: 0,
      },
      deliveryStatus: DeliveryStatus.DELIVERED,
      // A delivery with no date (restored from a report that did not carry
      // one) is old by definition; without this it would never archive.
      OR: [{ deliveredAt: { lte: archiveCutoff } }, { deliveredAt: null }],
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
      // This sweep runs on most page loads, so two can overlap. The condition
      // makes the second one a no-op instead of a duplicate audit entry.
      const { count } = await tx.customerAccount.updateMany({
        where: {
          id: account.id,
          status: AccountStatus.COMPLETED,
          deliveryStatus: DeliveryStatus.DELIVERED,
        },
        data: {
          status: AccountStatus.ARCHIVED,
        },
      });

      if (count === 0) {
        return;
      }

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

    const applied = await prisma.$transaction(async (tx) => {
      // Two overlapping sweeps both read this account before either wrote it.
      // Without the status condition both would close it and both would mint
      // a closure refund credit, paying the customer back twice.
      const { count } = await tx.customerAccount.updateMany({
        where: {
          id: account.id,
          status: account.status,
        },
        data: {
          status: nextStatus,
        },
      });

      if (count === 0) {
        return false;
      }

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

      return true;
    });

    if (
      applied &&
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
