import assert from "node:assert/strict";
import test from "node:test";
import { rankMonthlyStaffPerformance } from "../lib/monthly-staff-performance";

test("monthly staff rank by active accounts, independent of deposits and new accounts", () => {
  const rows = rankMonthlyStaffPerformance([
    { staffCode: "A", monthlyDeposits: 100, monthlyTarget: 100, activeAccounts: 2, newActiveAccounts: 0 },
    { staffCode: "B", monthlyDeposits: 0, monthlyTarget: 100, activeAccounts: 5, newActiveAccounts: 0 },
    { staffCode: "C", monthlyDeposits: 50, monthlyTarget: 0, activeAccounts: 0, newActiveAccounts: 5 },
  ]);
  assert.equal(rows[0].staffCode, "B");
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].targetAttainment, 0);
  assert.equal(rows[1].staffCode, "A");
  assert.equal(rows[1].rank, 2);
  assert.equal(rows[2].staffCode, "C");
  assert.equal(rows[2].targetAttainment, 0);
});

test("staff with equal active-account counts share rank even when performance differs", () => {
  const rows = rankMonthlyStaffPerformance([
    { staffCode: "A", monthlyDeposits: 120, monthlyTarget: 100, activeAccounts: 4, newActiveAccounts: 1 },
    { staffCode: "B", monthlyDeposits: 0, monthlyTarget: 200, activeAccounts: 4, newActiveAccounts: 0 },
    { staffCode: "C", monthlyDeposits: 0, monthlyTarget: 100, activeAccounts: 1, newActiveAccounts: 0 },
  ]);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, 1);
  assert.equal(rows[2].rank, 3);
});
