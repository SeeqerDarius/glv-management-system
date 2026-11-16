import assert from "node:assert/strict";
import { AccountStatus, type CustomerAccount } from "@prisma/client";
import { test } from "node:test";
import {
  collectionTargetForRange,
  collectionTargetForWeek,
  isUnfinishedCollectionTargetAccount,
} from "../lib/collection-targets";

function account(
  overrides: Partial<Pick<CustomerAccount, "status" | "balance" | "dailyAmount" | "startDate">> = {},
) {
  return {
    status: AccountStatus.ACTIVE,
    balance: 100,
    dailyAmount: 5,
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("every unpaid status contributes except cancelled and closed", () => {
  const statuses = Object.values(AccountStatus);
  for (const status of statuses) {
    const expected = status !== AccountStatus.CANCELLED && status !== AccountStatus.CLOSED;
    assert.equal(isUnfinishedCollectionTargetAccount(account({ status })), expected, status);
  }
  assert.equal(isUnfinishedCollectionTargetAccount(account({ balance: 0 })), false);
});

test("monthly target counts daily amounts from start date through the range, without expected-end cutoff", () => {
  const startDate = new Date("2026-11-02T00:00:00.000Z");
  const rows = [
    account({ status: AccountStatus.DORMANT, dailyAmount: 10, startDate }),
    account({ status: AccountStatus.SUSPENDED, dailyAmount: 20 }),
    account({ status: AccountStatus.CANCELLED, dailyAmount: 100 }),
    account({ status: AccountStatus.CLOSED, dailyAmount: 100 }),
    account({ balance: 0, dailyAmount: 100 }),
    account({ dailyAmount: 100, startDate: new Date("2026-11-05T00:00:00.000Z") }),
  ];
  assert.equal(
    collectionTargetForRange(rows, new Date("2026-11-01T00:00:00.000Z"), new Date("2026-11-04T23:59:59.999Z")),
    10 * 3 + 20 * 4,
  );
});

test("weekly target counts only accounts started by Monday and excludes paid, cancelled, and closed plans", () => {
  const monday = new Date("2026-11-09T00:00:00.000Z");
  assert.equal(collectionTargetForWeek(account({ status: AccountStatus.DORMANT, dailyAmount: 12 }), monday), 84);
  assert.equal(collectionTargetForWeek(account({ status: AccountStatus.CANCELLED }), monday), 0);
  assert.equal(collectionTargetForWeek(account({ status: AccountStatus.CLOSED }), monday), 0);
  assert.equal(collectionTargetForWeek(account({ balance: 0 }), monday), 0);
  assert.equal(collectionTargetForWeek(account({ startDate: new Date("2026-11-10T00:00:00.000Z") }), monday), 0);
});
