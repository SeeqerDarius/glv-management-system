import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectiveDeliveryAfterCompletionDays,
  effectiveRefundDeductionRate,
  minimumInitialDepositError,
} from "../lib/business-rules";
import {
  getClosureRefundAmounts,
  getDormantReactivationAmounts,
} from "../lib/account-lifecycle-rules";

test("delivery delay uses the saved positive day count and keeps the two-day fallback", () => {
  assert.equal(effectiveDeliveryAfterCompletionDays(5), 5);
  assert.equal(effectiveDeliveryAfterCompletionDays(0), 2);
  assert.equal(effectiveDeliveryAfterCompletionDays(null), 2);
});

test("refund deduction uses the saved percent and preserves the 32 percent fallback", () => {
  assert.equal(effectiveRefundDeductionRate(15), 0.15);
  assert.equal(effectiveRefundDeductionRate(0), 0.32);
  assert.equal(getClosureRefundAmounts(1000, 0.15).refundAmount, 850);
  assert.equal(getDormantReactivationAmounts(1000, 0.15).nextTotalPaid, 850);
});

test("minimum deposit is enforced only when configured", () => {
  assert.equal(minimumInitialDepositError(100, 99.99), 100);
  assert.equal(minimumInitialDepositError(100, 100), null);
  assert.equal(minimumInitialDepositError(0, 1), null);
});
