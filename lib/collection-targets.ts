import { AccountStatus, type CustomerAccount } from "@prisma/client";

export type CollectionTargetAccount = Pick<
  CustomerAccount,
  "status" | "balance" | "dailyAmount" | "startDate"
>;

/** An account remains target-bearing while it owes money, except if cancelled or closed. */
export function isUnfinishedCollectionTargetAccount(
  account: Pick<CollectionTargetAccount, "status" | "balance">,
) {
  return account.balance > 0 &&
    account.status !== AccountStatus.CANCELLED &&
    account.status !== AccountStatus.CLOSED;
}

/** Daily collection target for every eligible day in a reporting range. */
export function collectionTargetForRange(
  accounts: CollectionTargetAccount[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  return accounts.reduce((total, account) => {
    if (!isUnfinishedCollectionTargetAccount(account) || account.startDate > rangeEnd) {
      return total;
    }

    const activeStart = account.startDate > rangeStart ? account.startDate : rangeStart;
    if (activeStart > rangeEnd) return total;

    const activeDays = Math.floor(
      (rangeEnd.getTime() - activeStart.getTime()) / 86_400_000,
    ) + 1;
    return total + account.dailyAmount * activeDays;
  }, 0);
}

/** Weekly target for accounts already started by the Monday of the reporting week. */
export function collectionTargetForWeek(
  account: CollectionTargetAccount,
  weekStart: Date,
) {
  return isUnfinishedCollectionTargetAccount(account) && account.startDate <= weekStart
    ? account.dailyAmount * 7
    : 0;
}
