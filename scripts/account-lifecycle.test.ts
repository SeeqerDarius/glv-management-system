import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountStatus, DeliveryStatus } from "@prisma/client";
import {
  getAccountActivityDate,
  getArchiveRepairStatus,
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  getDormantReactivationCutoffDate,
  getNextLifecycleStatus,
  getStatusAfterBalanceChange,
  isAwaitingDelivery,
  isDormantReactivationEligible,
  isFinishedStatus,
} from "../lib/account-lifecycle-rules";

const DAY = 86_400_000;

function at(daysAgo: number, from = new Date("2026-09-21T09:00:00.000Z")) {
  return new Date(from.getTime() - daysAgo * DAY);
}

const NOW = new Date("2026-09-21T09:00:00.000Z");

function account(overrides: Partial<{
  status: AccountStatus;
  balance: number;
  startDate: Date;
  reactivatedAt: Date | null;
  payments: Array<{ paymentDate: Date }>;
}> = {}) {
  return {
    status: AccountStatus.ACTIVE,
    balance: 400,
    startDate: at(400),
    reactivatedAt: null,
    payments: [{ paymentDate: at(200) }],
    ...overrides,
  };
}

test("the activity clock takes the latest of start date, payment and reactivation", () => {
  assert.deepEqual(
    getAccountActivityDate({ startDate: at(400), reactivatedAt: null, payments: [{ paymentDate: at(200) }] }),
    at(200)
  );
  assert.deepEqual(
    getAccountActivityDate({ startDate: at(400), reactivatedAt: at(1), payments: [{ paymentDate: at(200) }] }),
    at(1)
  );
  // A reactivation older than the newest payment must not drag the clock back.
  assert.deepEqual(
    getAccountActivityDate({ startDate: at(400), reactivatedAt: at(90), payments: [{ paymentDate: at(2) }] }),
    at(2)
  );
  assert.deepEqual(
    getAccountActivityDate({ startDate: at(400), reactivatedAt: null, payments: [] }),
    at(400)
  );
});

test("an account idle for six months closes", () => {
  assert.equal(
    getNextLifecycleStatus(account({ payments: [{ paymentDate: at(200) }] }), NOW),
    AccountStatus.CLOSED
  );
  assert.equal(
    getNextLifecycleStatus(account({ payments: [{ paymentDate: at(140) }] }), NOW),
    AccountStatus.PROBATION
  );
  assert.equal(
    getNextLifecycleStatus(account({ payments: [{ paymentDate: at(30) }] }), NOW),
    AccountStatus.DORMANT
  );
  assert.equal(
    getNextLifecycleStatus(account({ payments: [{ paymentDate: at(3) }] }), NOW),
    AccountStatus.ACTIVE
  );
});

test("a reactivated account is not re-closed by the next lifecycle sweep", () => {
  // The regression: reactivation writes no payment, so the clock used to still
  // read the pre-closure payment date and the sweep re-closed the account
  // immediately, deducting the service fee a second time.
  const reactivated = account({
    status: AccountStatus.ACTIVE,
    payments: [{ paymentDate: at(200) }],
    reactivatedAt: NOW,
  });

  assert.equal(getNextLifecycleStatus(reactivated, NOW), AccountStatus.ACTIVE);
  // It rejoins the ladder from the reactivation, not from the stale payment.
  assert.equal(
    getNextLifecycleStatus(reactivated, new Date(NOW.getTime() + 22 * DAY)),
    AccountStatus.DORMANT
  );
  assert.equal(
    getNextLifecycleStatus(reactivated, new Date(NOW.getTime() + 200 * DAY)),
    AccountStatus.CLOSED
  );
});

test("reactivation eligibility is measured from the last reactivation", () => {
  const closed = account({ status: AccountStatus.CLOSED, payments: [{ paymentDate: at(200) }] });

  assert.equal(isDormantReactivationEligible(closed, NOW), true);
  assert.deepEqual(getDormantReactivationCutoffDate(closed), new Date("2026-09-05T09:00:00.000Z"));

  // Reactivating again on the same day would charge a second 32% fee.
  const justReactivated = { ...closed, reactivatedAt: NOW };
  assert.equal(isDormantReactivationEligible(justReactivated, NOW), false);
  assert.equal(
    isDormantReactivationEligible(justReactivated, new Date(NOW.getTime() + 100 * DAY)),
    false
  );
  // Six months of fresh inactivity makes it eligible once more.
  assert.equal(
    isDormantReactivationEligible(justReactivated, new Date(NOW.getTime() + 200 * DAY)),
    true
  );
});

test("only dormant, probation and closed accounts can be reactivated", () => {
  for (const status of [
    AccountStatus.DORMANT,
    AccountStatus.PROBATION,
    AccountStatus.CLOSED,
  ]) {
    assert.equal(isDormantReactivationEligible(account({ status }), NOW), true);
  }
  for (const status of [
    AccountStatus.ACTIVE,
    AccountStatus.OVERDUE,
    AccountStatus.COMPLETED,
    AccountStatus.CANCELLED,
    AccountStatus.SUSPENDED,
    AccountStatus.ARCHIVED,
  ]) {
    assert.equal(isDormantReactivationEligible(account({ status }), NOW), false);
  }
});

test("the 32% deduction never pushes a balance negative", () => {
  const { serviceFee, nextTotalPaid } = getDormantReactivationAmounts(1000);
  assert.equal(serviceFee, 320);
  assert.equal(nextTotalPaid, 680);

  assert.deepEqual(getDormantReactivationAmounts(0), {
    serviceFee: 0,
    nextTotalPaid: 0,
    serviceFeeRate: 0.32,
  });
  // A negative paid figure is bad data, not a reason to invent a refund.
  assert.equal(getDormantReactivationAmounts(-50).serviceFee, 0);
  assert.equal(getDormantReactivationAmounts(-50).nextTotalPaid, 0);

  assert.equal(getClosureRefundAmounts(1000).refundAmount, 680);
  assert.equal(getClosureRefundAmounts(1000).serviceFee, 320);
});

test("archived plans count as completed, everything else does not", () => {
  assert.equal(isFinishedStatus(AccountStatus.COMPLETED), true);
  assert.equal(isFinishedStatus(AccountStatus.ARCHIVED), true);
  for (const status of [
    AccountStatus.ACTIVE,
    AccountStatus.OVERDUE,
    AccountStatus.DORMANT,
    AccountStatus.PROBATION,
    AccountStatus.CLOSED,
    AccountStatus.CANCELLED,
    AccountStatus.SUSPENDED,
  ]) {
    assert.equal(isFinishedStatus(status), false);
  }
});

test("a paid-off plan is awaiting delivery until it is handed over, archived or not", () => {
  const paidOff = { balance: 0, deliveryStatus: DeliveryStatus.PENDING };

  assert.equal(isAwaitingDelivery({ ...paidOff, status: AccountStatus.COMPLETED }), true);
  // The regression: an archived plan still owed its product dropped out of
  // every delivery queue, and nothing on its page could mark it delivered.
  assert.equal(isAwaitingDelivery({ ...paidOff, status: AccountStatus.ARCHIVED }), true);
  assert.equal(
    isAwaitingDelivery({ ...paidOff, status: AccountStatus.COMPLETED, deliveryStatus: DeliveryStatus.DELIVERED }),
    false
  );
  // Money still owed means it is not ready, whatever its status says.
  assert.equal(isAwaitingDelivery({ ...paidOff, status: AccountStatus.ACTIVE }), false);
  assert.equal(isAwaitingDelivery({ ...paidOff, balance: 50, status: AccountStatus.COMPLETED }), false);
});

test("the archive keeps only plans that are paid off and delivered", () => {
  assert.equal(
    getArchiveRepairStatus({ status: AccountStatus.ARCHIVED, balance: 0, deliveryStatus: DeliveryStatus.DELIVERED }),
    null
  );
  // Still owed its product: back to the delivery queue.
  assert.equal(
    getArchiveRepairStatus({ status: AccountStatus.ARCHIVED, balance: 0, deliveryStatus: DeliveryStatus.PENDING }),
    AccountStatus.COMPLETED
  );
  // Owes money again: back to collection, delivered or not.
  assert.equal(
    getArchiveRepairStatus({ status: AccountStatus.ARCHIVED, balance: 120, deliveryStatus: DeliveryStatus.DELIVERED }),
    AccountStatus.ACTIVE
  );
  assert.equal(
    getArchiveRepairStatus({ status: AccountStatus.ARCHIVED, balance: 120, deliveryStatus: DeliveryStatus.PENDING }),
    AccountStatus.ACTIVE
  );
  // Only archived accounts are ever touched.
  assert.equal(
    getArchiveRepairStatus({ status: AccountStatus.COMPLETED, balance: 0, deliveryStatus: DeliveryStatus.PENDING }),
    null
  );
});

test("a balance change reopens or completes a plan without stranding it in the archive", () => {
  assert.equal(getStatusAfterBalanceChange(AccountStatus.ACTIVE, 0), AccountStatus.COMPLETED);
  assert.equal(getStatusAfterBalanceChange(AccountStatus.COMPLETED, 0), AccountStatus.COMPLETED);
  assert.equal(getStatusAfterBalanceChange(AccountStatus.ARCHIVED, 0), AccountStatus.ARCHIVED);

  assert.equal(getStatusAfterBalanceChange(AccountStatus.COMPLETED, 75), AccountStatus.ACTIVE);
  // The regression: deleting a payment on an archived plan left it archived
  // with money owing, and archived plans refuse payments.
  assert.equal(getStatusAfterBalanceChange(AccountStatus.ARCHIVED, 75), AccountStatus.ACTIVE);
  assert.equal(getStatusAfterBalanceChange(AccountStatus.DORMANT, 75), AccountStatus.DORMANT);
  assert.equal(getStatusAfterBalanceChange(AccountStatus.CLOSED, 75), AccountStatus.CLOSED);
});
