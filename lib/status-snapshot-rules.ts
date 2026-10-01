import { AccountStatus, DeliveryStatus } from "@prisma/client";
import { getEffectiveAccountStatus } from "@/lib/accounts";
import {
  isAwaitingDelivery,
  isFinishedStatus,
} from "@/lib/account-lifecycle-rules";

/**
 * The status figures a daily snapshot keeps, so the dashboard can compare them
 * with a week ago. Account status has no history of its own, so without a
 * snapshot there is no honest "last week" to compare these with. Pure, so
 * `scripts/status-snapshots.test.ts` can check the counting.
 */
export type StatusSnapshotCounts = {
  active: number;
  overdue: number;
  completedDelivered: number;
  awaitingDelivery: number;
};

export type StatusSnapshot = StatusSnapshotCounts & {
  date: string;
  byStaff: Record<string, StatusSnapshotCounts>;
};

type SnapshotAccount = {
  status: AccountStatus;
  balance: number;
  expectedEndDate: Date;
  deliveryStatus: DeliveryStatus;
  customer: { staffId: string };
};

function emptyCounts(): StatusSnapshotCounts {
  return { active: 0, overdue: 0, completedDelivered: 0, awaitingDelivery: 0 };
}

function addAccount(counts: StatusSnapshotCounts, account: SnapshotAccount) {
  const status = getEffectiveAccountStatus(account);

  if (status === AccountStatus.ACTIVE) counts.active += 1;
  if (status === AccountStatus.OVERDUE) counts.overdue += 1;
  if (
    isFinishedStatus(account.status) &&
    account.deliveryStatus === DeliveryStatus.DELIVERED
  ) {
    counts.completedDelivered += 1;
  }
  if (isAwaitingDelivery(account)) counts.awaitingDelivery += 1;
}

export function buildStatusSnapshot(
  date: string,
  accounts: SnapshotAccount[]
): StatusSnapshot {
  const totals = emptyCounts();
  const byStaff: Record<string, StatusSnapshotCounts> = {};

  for (const account of accounts) {
    addAccount(totals, account);
    addAccount((byStaff[account.customer.staffId] ??= emptyCounts()), account);
  }

  return { date, ...totals, byStaff };
}

/** A stored snapshot, or null when the row is unreadable or from an old shape. */
export function parseStatusSnapshot(value: string | null | undefined) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StatusSnapshot>;
    return typeof parsed.date === "string" &&
      typeof parsed.active === "number" &&
      typeof parsed.overdue === "number" &&
      typeof parsed.completedDelivered === "number" &&
      typeof parsed.awaitingDelivery === "number"
      ? (parsed as StatusSnapshot)
      : null;
  } catch {
    return null;
  }
}
