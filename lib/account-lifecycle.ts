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
import { getSettings } from "@/lib/settings";
import { recordDailyStatusSnapshot } from "@/lib/status-snapshots";
import {
  ARCHIVE_AFTER_DELIVERY_DAYS,
  addDays,
  getAccountActivityDate,
  formatServiceFeeRate,
  getArchiveRepairStatus,
  getClosureRefundAmounts,
  getNextLifecycleStatus,
  resolveServiceFeeRate,
} from "@/lib/account-lifecycle-rules";

// The lifecycle rules are re-exported so callers keep a single import site.
export {
  DORMANT_REACTIVATION_SERVICE_FEE_RATE,
  formatServiceFeeRate,
  getAccountActivityDate,
  getArchiveRepairStatus,
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  getDeliveryWait,
  getDormantReactivationCutoffDate,
  getNextLifecycleStatus,
  getPaidOffDate,
  getStatusAfterBalanceChange,
  isAwaitingDelivery,
  isDormantReactivationEligible,
  isFinishedStatus,
} from "@/lib/account-lifecycle-rules";

/**
 * The two Business Rules settings the account lifecycle reads: the service fee
 * on closure refunds and reactivations (Refund Deduction %, 32% until set) and
 * the delivery target for paid-off plans (Delivery Time After Completion, none
 * until set).
 */
export async function getLifecycleBusinessRules() {
  const settings = await getSettings();
  const targetDays = Number(settings.deliveryTimeAfterCompletionDays);

  return {
    serviceFeeRate: resolveServiceFeeRate(settings.refundDeductionPercent),
    deliveryTargetDays:
      Number.isFinite(targetDays) && targetDays > 0 ? Math.floor(targetDays) : 0,
  };
}

/** How often a page view may re-run the sweep on one server instance. */
const LIFECYCLE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const lifecycleSweepState = globalThis as unknown as {
  glvLifecycleSweep?: { lastRunAt: number; inFlight: Promise<void> | null };
};

/**
 * Keeps lifecycle statuses fresh without sweeping on every request. The full
 * sweep runs from the daily cron; pages call this, which runs it at most once
 * every few minutes per server instance and lets concurrent page loads share
 * one run. Before this the sweep ran on every list, detail page and sidebar
 * notification poll, one transaction per changed account each time.
 *
 * Statuses an operator changes directly (a payment, a delivery, a
 * reactivation) are written by that action, so only the time-based moves
 * (dormancy, closure, archiving) can trail by those few minutes.
 */
export async function ensureLifecycleStatusesFresh() {
  const state = (lifecycleSweepState.glvLifecycleSweep ??= {
    lastRunAt: 0,
    inFlight: null,
  });

  if (state.inFlight) {
    return state.inFlight;
  }

  if (Date.now() - state.lastRunAt < LIFECYCLE_SWEEP_INTERVAL_MS) {
    return;
  }

  state.inFlight = refreshAccountLifecycleStatuses()
    .then(async () => {
      state.lastRunAt = Date.now();
      // The first sweep of the day also files the day's status snapshot, so
      // the dashboard's week-over-week comparison does not depend on the cron
      // alone. A failed snapshot never fails the page.
      await recordDailyStatusSnapshot().catch((error) =>
        console.error("STATUS_SNAPSHOT_ERROR", error)
      );
    })
    .finally(() => {
      state.inFlight = null;
    });

  return state.inFlight;
}

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

  const { serviceFeeRate: configuredFeeRate } = accounts.length
    ? await getLifecycleBusinessRules()
    : { serviceFeeRate: undefined };

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
          getClosureRefundAmounts(account.totalPaid, configuredFeeRate);

        if (refundAmount > 0) {
          const credit = await tx.customerCredit.create({
            data: {
              customerId: account.customerId,
              accountId: account.id,
              amount: refundAmount,
              remainingAmount: refundAmount,
              status: CreditStatus.OPEN,
              source: CreditSource.ACCOUNT_CLOSURE_REFUND,
              notes: `Account closed after inactivity. Service fee deducted: ${formatServiceFeeRate(serviceFeeRate)}.`,
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
        getClosureRefundAmounts(account.totalPaid, configuredFeeRate);
      await createAccountDocument({
        accountId: account.id,
        templateKey: LEGAL_TEMPLATE_KEYS.CANCELLATION,
        type: "ACCOUNT_CLOSURE_CALCULATION",
        createdBy: "system",
        dedupeBase: `ACCOUNT_CLOSURE_CALCULATION:${account.id}`,
        values: {
          deductionRate: formatServiceFeeRate(serviceFeeRate),
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
