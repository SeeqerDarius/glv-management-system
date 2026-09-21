export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

// Missed-payment reminders start only after two full weeks without a payment,
// then repeat once for every further two-week gap.
export const MISSED_PAYMENT_WINDOW_MS = 2 * WEEK_MS;
export const MISSED_PAYMENT_WINDOW_DAYS = 14;

export function normalizeSmsPhone(value: string | null | undefined) {
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^0\d{9}$/.test(digits)) digits = `233${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("233") && !/^233[235]\d{8}$/.test(digits)) return null;
  if (!digits.startsWith("233") && !value.startsWith("+") && !value.startsWith("00")) return null;
  return `+${digits}`;
}

// A record with no usable number is never queued and never dispatched, so the
// provider is not called and no failed row is left behind for it.
export function hasSmsRecipient(value: string | null | undefined) {
  return normalizeSmsPhone(value) !== null;
}

export function reachedSmsMilestone(totalPaid: number, targetAmount: number) {
  return targetAmount > 0 && Number.isFinite(targetAmount) &&
    Number.isFinite(totalPaid) && Math.round(totalPaid * 100) * 10 >= Math.round(targetAmount * 100) * 7;
}

/** Weekly amount a customer is expected to pay across their collecting accounts. */
export function expectedWeeklyAmount(dailyAmounts: Array<number | null | undefined>) {
  const daily = dailyAmounts.reduce<number>((total, amount) => {
    return total + (typeof amount === "number" && Number.isFinite(amount) ? Math.max(amount, 0) : 0);
  }, 0);
  return daily * 7;
}

/** True when the customer paid at least the expected weekly amount. */
export function metWeeklyTarget(paidAmount: number, expectedAmount: number) {
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return true;
  if (!Number.isFinite(paidAmount)) return false;
  // Compare in pesewas so float noise never turns an exact week into a shortfall.
  return Math.round(paidAmount * 100) >= Math.round(expectedAmount * 100);
}

export function missedPaymentPeriod(account: {
  status: string; balance: number; startDate: Date; reactivatedAt?: Date | null;
  payments: Array<{ id: string; paymentDate: Date; createdAt: Date }>;
}, now = new Date()) {
  if (!["ACTIVE", "OVERDUE"].includes(account.status) || account.balance <= 0) return null;
  const latest = account.payments[0];
  // A backdated payment entered today also resets reminders. So does a
  // reactivation, which restarts the plan and must not fire a reminder for the
  // months the account spent dormant before it.
  const reactivatedAt = account.reactivatedAt?.getTime() ?? 0;
  const anchor = Math.max(account.startDate.getTime(), latest?.paymentDate.getTime() ?? 0,
    latest?.createdAt.getTime() ?? 0, reactivatedAt);
  const period = Math.floor((now.getTime() - anchor) / MISSED_PAYMENT_WINDOW_MS);
  if (period < 1) return null;
  const base = latest?.id ?? account.startDate.toISOString();
  // Reactivation restarts the period count at 1, which would collide with a
  // reminder already sent before the account closed and silently dedupe it
  // away. Such an account gets its own key namespace. An account that was
  // never reactivated keeps the original key, so reminders already queued
  // under it stay deduped.
  return account.reactivatedAt && anchor === reactivatedAt
    ? `${base}:r${reactivatedAt}:${period}`
    : `${base}:${period}`;
}
