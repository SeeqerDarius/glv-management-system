import { todayDateInputValue } from "@/lib/date-rules";
import { prisma } from "@/lib/prisma";
import {
  buildStatusSnapshot,
  parseStatusSnapshot,
} from "@/lib/status-snapshot-rules";

/**
 * Daily account-status snapshots, kept as one audit-log row per day
 * (`ACCOUNT_STATUS_SNAPSHOT`, entity `AccountStatusSnapshot`, entityId the
 * date) so no schema change is needed. The audit log is append-only history
 * already, and a snapshot is exactly that: what the account book looked like
 * on a given day.
 */
const SNAPSHOT_ACTION = "ACCOUNT_STATUS_SNAPSHOT";
const SNAPSHOT_ENTITY = "AccountStatusSnapshot";
const DAY_MS = 86_400_000;

/** Writes today's snapshot unless one exists. Safe to call often. */
export async function recordDailyStatusSnapshot(now = new Date()) {
  const date = todayDateInputValue(now);
  const existing = await prisma.auditLog.findFirst({
    where: { action: SNAPSHOT_ACTION, entity: SNAPSHOT_ENTITY, entityId: date },
    select: { id: true },
  });

  if (existing) {
    return false;
  }

  const accounts = await prisma.customerAccount.findMany({
    select: {
      status: true,
      balance: true,
      expectedEndDate: true,
      deliveryStatus: true,
      customer: { select: { staffId: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: "system",
      action: SNAPSHOT_ACTION,
      entity: SNAPSHOT_ENTITY,
      entityId: date,
      newValue: JSON.stringify(buildStatusSnapshot(date, accounts)),
    },
  });

  return true;
}

/**
 * The snapshot from a week ago, or the nearest earlier one within three more
 * days. Null until the snapshots reach back that far, so the dashboard shows no
 * comparison rather than an invented one.
 */
export async function getStatusSnapshotWeekAgo(now = new Date()) {
  const target = todayDateInputValue(new Date(now.getTime() - 7 * DAY_MS));
  const earliest = todayDateInputValue(new Date(now.getTime() - 10 * DAY_MS));
  const row = await prisma.auditLog.findFirst({
    where: {
      action: SNAPSHOT_ACTION,
      entity: SNAPSHOT_ENTITY,
      entityId: { lte: target, gte: earliest },
    },
    orderBy: { entityId: "desc" },
    select: { newValue: true },
  });

  return parseStatusSnapshot(row?.newValue);
}
