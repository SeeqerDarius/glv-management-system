import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountStatus, DeliveryStatus } from "@prisma/client";
import {
  buildStatusSnapshot,
  parseStatusSnapshot,
} from "../lib/status-snapshot-rules";

const future = new Date(Date.now() + 30 * 86_400_000);
const past = new Date(Date.now() - 30 * 86_400_000);

function account(
  staffId: string,
  status: AccountStatus,
  overrides: Partial<{ balance: number; expectedEndDate: Date; deliveryStatus: DeliveryStatus }> = {}
) {
  return {
    status,
    balance: 100,
    expectedEndDate: future,
    deliveryStatus: DeliveryStatus.PENDING,
    customer: { staffId },
    ...overrides,
  };
}

test("a snapshot counts the dashboard's status figures, in total and per staff", () => {
  const snapshot = buildStatusSnapshot("2026-10-01", [
    account("s1", AccountStatus.ACTIVE),
    // Overdue is derived from the end date, exactly as the dashboard does it.
    account("s1", AccountStatus.ACTIVE, { expectedEndDate: past }),
    account("s2", AccountStatus.COMPLETED, { balance: 0 }),
    account("s2", AccountStatus.ARCHIVED, { balance: 0 }),
    account("s2", AccountStatus.ARCHIVED, { balance: 0, deliveryStatus: DeliveryStatus.DELIVERED }),
    account("s2", AccountStatus.COMPLETED, { balance: 0, deliveryStatus: DeliveryStatus.DELIVERED }),
    account("s1", AccountStatus.CLOSED),
  ]);

  assert.equal(snapshot.date, "2026-10-01");
  assert.equal(snapshot.active, 1);
  assert.equal(snapshot.overdue, 1);
  assert.equal(snapshot.completedDelivered, 2);
  // An archived plan still owed its product counts as awaiting delivery.
  assert.equal(snapshot.awaitingDelivery, 2);
  assert.deepEqual(snapshot.byStaff.s1, {
    active: 1,
    overdue: 1,
    completedDelivered: 0,
    awaitingDelivery: 0,
  });
  assert.equal(snapshot.byStaff.s2.awaitingDelivery, 2);
});

test("only a complete stored snapshot is read back", () => {
  const stored = JSON.stringify(buildStatusSnapshot("2026-09-24", []));
  assert.equal(parseStatusSnapshot(stored)?.date, "2026-09-24");
  assert.equal(parseStatusSnapshot(null), null);
  assert.equal(parseStatusSnapshot("not json"), null);
  assert.equal(parseStatusSnapshot(JSON.stringify({ date: "2026-09-24" })), null);
});
