import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountStatus, DeliveryStatus } from "@prisma/client";
import {
  hasReachedProcurementThreshold,
  isProcurementEligible,
} from "../lib/procurement";

const THRESHOLD = 70;

function account(
  totalPaid: number,
  targetAmount: number,
  status: AccountStatus = AccountStatus.ACTIVE,
  deliveryStatus: DeliveryStatus = DeliveryStatus.PENDING
) {
  return { totalPaid, targetAmount, status, deliveryStatus };
}

test("GHS 210 paid toward GHS 1,840 (11.41%) is below a 70% threshold", () => {
  assert.equal(hasReachedProcurementThreshold(210, 1840, THRESHOLD), false);
  assert.equal(isProcurementEligible(account(210, 1840), THRESHOLD), false);
});

test("one pesewa below the threshold is excluded", () => {
  // 70% of GHS 1,840 is GHS 1,288.00.
  assert.equal(isProcurementEligible(account(1287.99, 1840), THRESHOLD), false);
});

test("exactly at the threshold is included", () => {
  assert.equal(isProcurementEligible(account(1288, 1840), THRESHOLD), true);
  // Float-backed money: 0.1 + 0.2 style noise must not tip either way.
  assert.equal(isProcurementEligible(account(70.000000001, 100), THRESHOLD), true);
  assert.equal(isProcurementEligible(account(69.999999999, 100), THRESHOLD), true);
  assert.equal(isProcurementEligible(account(0.7, 1), THRESHOLD), true);
});

test("above the threshold is included, up to fully paid", () => {
  assert.equal(isProcurementEligible(account(1500, 1840), THRESHOLD), true);
  assert.equal(
    isProcurementEligible(account(1840, 1840, AccountStatus.COMPLETED), THRESHOLD),
    true
  );
});

test("fully paid accounts still awaiting delivery are included", () => {
  assert.equal(
    isProcurementEligible(account(1840, 1840, AccountStatus.COMPLETED), THRESHOLD),
    true
  );
});

test("delivered accounts are excluded even when paid past the threshold", () => {
  assert.equal(
    isProcurementEligible(
      account(1840, 1840, AccountStatus.COMPLETED, DeliveryStatus.DELIVERED),
      THRESHOLD
    ),
    false
  );
  assert.equal(
    isProcurementEligible(
      account(1500, 1840, AccountStatus.ACTIVE, DeliveryStatus.DELIVERED),
      THRESHOLD
    ),
    false
  );
});

test("closed, archived, cancelled and suspended accounts are excluded", () => {
  for (const status of [
    AccountStatus.CLOSED,
    AccountStatus.ARCHIVED,
    AccountStatus.CANCELLED,
    AccountStatus.SUSPENDED,
  ]) {
    assert.equal(
      isProcurementEligible(account(1840, 1840, status), THRESHOLD),
      false,
      status
    );
  }
});

test("working statuses at the threshold are included", () => {
  for (const status of [
    AccountStatus.ACTIVE,
    AccountStatus.OVERDUE,
    AccountStatus.DORMANT,
    AccountStatus.PROBATION,
  ]) {
    assert.equal(
      isProcurementEligible(account(1288, 1840, status), THRESHOLD),
      true,
      status
    );
  }
});

test("a missing or zero target never meets the threshold", () => {
  assert.equal(isProcurementEligible(account(100, 0), THRESHOLD), false);
  assert.equal(isProcurementEligible(account(Number.NaN, 100), THRESHOLD), false);
});

test("the configured percentage is honoured", () => {
  assert.equal(isProcurementEligible(account(1288, 1840), 80), false);
  assert.equal(isProcurementEligible(account(1472, 1840), 80), true);
});
