import { AccountStatus, DeliveryStatus } from "@prisma/client";

/**
 * Pure lifecycle arithmetic: the dormancy ladder, the closure deduction and the
 * reactivation rules. Kept free of database and server-only imports so the
 * money rules can be unit tested (`scripts/account-lifecycle.test.ts`).
 * `lib/account-lifecycle.ts` applies them to real accounts.
 */

const DORMANT_AFTER_DAYS = 21;
const PROBATION_AFTER_MONTHS = 4;
const CLOSE_AFTER_MONTHS = 6;
export const ARCHIVE_AFTER_DELIVERY_DAYS = 2;
const CLOSURE_SERVICE_FEE_RATE = 0.32;
export const DORMANT_REACTIVATION_SERVICE_FEE_RATE = 0.32;

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * The account's activity clock. Reactivating an account is itself an activity
 * event, so it counts alongside the start date and the latest payment. Without
 * it a reactivated account still reads as months idle and the next lifecycle
 * sweep closes it again before the customer can pay anything.
 */
export function getAccountActivityDate(account: {
  startDate: Date;
  reactivatedAt?: Date | null;
  payments: Array<{ paymentDate: Date }>;
}) {
  const candidates = [account.startDate, account.payments[0]?.paymentDate, account.reactivatedAt];
  return candidates.reduce<Date>(
    (latest, candidate) => (candidate && candidate > latest ? candidate : latest),
    account.startDate
  );
}

export function getDormantReactivationCutoffDate(account: {
  startDate: Date;
  reactivatedAt?: Date | null;
  payments: Array<{ paymentDate: Date }>;
}) {
  return addMonths(getAccountActivityDate(account), CLOSE_AFTER_MONTHS);
}

export function isDormantReactivationEligible(
  account: {
    status: AccountStatus;
    startDate: Date;
    reactivatedAt?: Date | null;
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

export function getNextLifecycleStatus(
  account: {
    status: AccountStatus;
    balance: number;
    startDate: Date;
    reactivatedAt?: Date | null;
    payments: Array<{ paymentDate: Date }>;
  },
  now: Date
) {
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

  const lastActivityDate = getAccountActivityDate(account);

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

/**
 * A plan the customer has paid off. ARCHIVED is not a separate outcome: it is a
 * completed plan that was delivered and then filed away, so every count of
 * completed plans has to include it or the figure shrinks each time the
 * archive sweep runs.
 */
export function isFinishedStatus(status: AccountStatus) {
  return status === AccountStatus.COMPLETED || status === AccountStatus.ARCHIVED;
}

/** Paid in full and still waiting for the product to be handed over. */
export function isAwaitingDelivery(account: {
  status: AccountStatus;
  balance: number;
  deliveryStatus: DeliveryStatus;
}) {
  return (
    isFinishedStatus(account.status) &&
    account.balance <= 0 &&
    account.deliveryStatus === DeliveryStatus.PENDING
  );
}

/**
 * The archive holds finished work only: paid in full and handed over. An
 * archived account that is still owed its product, or that owes money again
 * (a payment deleted, a price raised), has to come back to the working list,
 * because nothing can be done to an archived account. Returns the status it
 * belongs in, or null when it still belongs in the archive.
 */
export function getArchiveRepairStatus(account: {
  status: AccountStatus;
  balance: number;
  deliveryStatus: DeliveryStatus;
}) {
  if (account.status !== AccountStatus.ARCHIVED) {
    return null;
  }

  if (account.balance > 0) {
    return AccountStatus.ACTIVE;
  }

  if (account.deliveryStatus !== DeliveryStatus.DELIVERED) {
    return AccountStatus.COMPLETED;
  }

  return null;
}

/**
 * The status an account takes when the amount it owes changes underneath it:
 * a price override, a product correction, or a payment edited, deleted or
 * restored. Paying off completes the plan (an archived plan stays archived);
 * owing again reopens a finished plan, archived included, so it can be
 * collected on. Any other status is left for the lifecycle sweep to judge.
 */
export function getStatusAfterBalanceChange(
  status: AccountStatus,
  nextBalance: number
) {
  if (nextBalance <= 0) {
    return status === AccountStatus.ARCHIVED
      ? AccountStatus.ARCHIVED
      : AccountStatus.COMPLETED;
  }

  return isFinishedStatus(status) ? AccountStatus.ACTIVE : status;
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
