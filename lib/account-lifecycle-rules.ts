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
/** GLV's standard service fee on a closure refund and on a reactivation. */
export const STANDARD_SERVICE_FEE_RATE = 0.32;
export const DORMANT_REACTIVATION_SERVICE_FEE_RATE = STANDARD_SERVICE_FEE_RATE;
const DAY_MS = 86_400_000;

/**
 * The service fee rate the business has configured in Settings > Business Rules
 * > Refund Deduction %, used for both closure refunds and reactivations. The
 * field shipped at 0 and was never read, so 0 (or an unusable value) means "not
 * configured" and keeps the standard 32%. Reading 0 as a real rate would have
 * silently started refunding closures in full and reactivating for free the
 * moment this was wired up.
 */
export function resolveServiceFeeRate(
  configuredPercent: number | null | undefined
) {
  const value = Number(configuredPercent);
  return Number.isFinite(value) && value > 0 && value <= 100
    ? value / 100
    : STANDARD_SERVICE_FEE_RATE;
}

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

/** "32%", "12.5%": the rate as the customer documents should state it. */
export function formatServiceFeeRate(rate: number) {
  return `${Number((rate * 100).toFixed(2))}%`;
}

export function getDormantReactivationAmounts(
  totalPaid: number,
  serviceFeeRate = STANDARD_SERVICE_FEE_RATE
) {
  const serviceFee = Math.max(totalPaid, 0) * serviceFeeRate;
  const nextTotalPaid = Math.max(totalPaid - serviceFee, 0);

  return {
    serviceFee,
    nextTotalPaid,
    serviceFeeRate,
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

export function getClosureRefundAmounts(
  totalPaid: number,
  serviceFeeRate = STANDARD_SERVICE_FEE_RATE
) {
  const serviceFee = totalPaid * serviceFeeRate;
  const refundAmount = Math.max(totalPaid - serviceFee, 0);

  return {
    refundAmount,
    serviceFee,
    serviceFeeRate,
  };
}

/**
 * When a paid-off plan was paid off. No payment can be recorded on a completed
 * plan, so its latest payment is the one that cleared it (payments newest
 * first). A plan completed by a price change rather than a payment reads from
 * its last payment, which is as close as the records allow.
 */
export function getPaidOffDate(account: {
  startDate: Date;
  payments: Array<{ paymentDate: Date }>;
}) {
  return account.payments[0]?.paymentDate ?? account.startDate;
}

/**
 * How long a paid-off plan has waited for its product, against the delivery
 * target in Settings > Business Rules > Delivery Time After Completion. A
 * target of 0 means none is set, so nothing is ever late; it only shows the
 * wait. A plan is late from the day after its target is used up.
 */
export function getDeliveryWait(
  paidOffAt: Date,
  targetDays: number | null | undefined,
  now = new Date()
) {
  const daysWaiting = Math.max(
    Math.floor((now.getTime() - paidOffAt.getTime()) / DAY_MS),
    0
  );
  const target = Number(targetDays);
  const deliveryTargetDays =
    Number.isFinite(target) && target > 0 ? Math.floor(target) : 0;

  return {
    daysWaiting,
    deliveryTargetDays,
    late: deliveryTargetDays > 0 && daysWaiting > deliveryTargetDays,
    dueBy:
      deliveryTargetDays > 0 ? addDays(paidOffAt, deliveryTargetDays) : null,
  };
}
