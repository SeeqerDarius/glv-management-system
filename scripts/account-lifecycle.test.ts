import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountStatus } from "@prisma/client";
import {
  getAccountActivityDate,
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
  getDormantReactivationCutoffDate,
  getNextLifecycleStatus,
  isDormantReactivationEligible,
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
