import { AccountStatus } from "@prisma/client";

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

export function getClosureRefundAmounts(totalPaid: number) {
  const serviceFee = totalPaid * CLOSURE_SERVICE_FEE_RATE;
  const refundAmount = Math.max(totalPaid - serviceFee, 0);

  return {
    refundAmount,
    serviceFee,
    serviceFeeRate: CLOSURE_SERVICE_FEE_RATE,
  };
}
