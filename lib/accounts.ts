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
