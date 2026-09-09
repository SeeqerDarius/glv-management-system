export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

export function reachedSmsMilestone(totalPaid: number, targetAmount: number) {
  return targetAmount > 0 && Number.isFinite(targetAmount) &&
    Number.isFinite(totalPaid) && Math.round(totalPaid * 100) * 10 >= Math.round(targetAmount * 100) * 7;
}

export function missedPaymentPeriod(account: {
  status: string; balance: number; startDate: Date;
  payments: Array<{ id: string; paymentDate: Date; createdAt: Date }>;
}, now = new Date()) {
  if (!["ACTIVE", "OVERDUE"].includes(account.status) || account.balance <= 0) return null;
  const latest = account.payments[0];
  // A backdated payment entered today also resets reminders.
  const anchor = Math.max(account.startDate.getTime(), latest?.paymentDate.getTime() ?? 0,
    latest?.createdAt.getTime() ?? 0);
  const week = Math.floor((now.getTime() - anchor) / WEEK_MS);
  return week >= 1 ? `${latest?.id ?? account.startDate.toISOString()}:${week}` : null;
}
