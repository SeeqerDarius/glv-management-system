import { AccountStatus, type CustomerAccount } from "@prisma/client";

type AccountStatusInput = Pick<
  CustomerAccount,
  "status" | "expectedEndDate" | "balance"
>;

export function getEffectiveAccountStatus(account: AccountStatusInput) {
  if (
    account.status === AccountStatus.ACTIVE &&
    account.balance > 0 &&
    new Date() > account.expectedEndDate
  ) {
    return AccountStatus.OVERDUE;
  }

  return account.status;
}

export function formatMoney(value: number) {
  return `GHS ${value.toFixed(2)}`;
}

export function getAccountDaysProgress({
  totalPaid,
  dailyAmount,
  duration,
}: {
  totalPaid: number;
  dailyAmount: number;
  duration: number;
}) {
  const safeDuration = Math.max(Math.floor(duration), 0);
  const calculatedDays =
    dailyAmount > 0 ? Math.floor(Math.max(totalPaid, 0) / dailyAmount) : 0;
  const daysPaidFor = Math.min(calculatedDays, safeDuration);
  const daysRemaining = Math.max(safeDuration - daysPaidFor, 0);
  const progressPercentage =
    safeDuration > 0 ? (daysPaidFor / safeDuration) * 100 : 0;

  return {
    daysPaidFor,
    daysRemaining,
    duration: safeDuration,
    progressPercentage,
  };
}
