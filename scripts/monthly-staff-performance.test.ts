import assert from "node:assert/strict";
import test from "node:test";
import { rankMonthlyStaffPerformance } from "../lib/monthly-staff-performance";

test("monthly staff ranks by weighted target attainment and new active accounts", () => {
  const rows = rankMonthlyStaffPerformance([
    { staffCode: "A", monthlyDeposits: 100, monthlyTarget: 100, newActiveAccounts: 0 },
    { staffCode: "B", monthlyDeposits: 90, monthlyTarget: 100, newActiveAccounts: 5 },
    { staffCode: "C", monthlyDeposits: 50, monthlyTarget: 0, newActiveAccounts: 0 },
  ]);
  assert.equal(rows[0].staffCode, "B");
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].targetAttainment, 0.9);
  assert.equal(rows[0].score, 80);
  assert.equal(rows[1].staffCode, "A");
  assert.equal(rows[1].score, 66.67);
  assert.equal(rows[2].staffCode, "C");
  assert.equal(rows[2].targetAttainment, 0);
});

test("target attainment is capped at 120 percent and exact ties share rank", () => {
  const rows = rankMonthlyStaffPerformance([
    { staffCode: "A", monthlyDeposits: 120, monthlyTarget: 100, newActiveAccounts: 1 },
    { staffCode: "B", monthlyDeposits: 240, monthlyTarget: 200, newActiveAccounts: 1 },
    { staffCode: "C", monthlyDeposits: 0, monthlyTarget: 100, newActiveAccounts: 0 },
  ]);
  assert.equal(rows[0].score, 100);
  assert.equal(rows[1].score, 100);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, 1);
  assert.equal(rows[2].rank, 3);
});
