import assert from "node:assert/strict";
import { test } from "node:test";
import { queueWeeklyStaffPerformanceSms } from "../lib/sms-notifications";

test("one staff member's completed-week deposit triggers only their SMS; Weekly Recorded payments determine rank", async () => {
  const messages: Array<{ type: string; dedupeKey: string; recipient: string; body: string; sourceId: string }> = [];
  const tx = {
    setting: {
      findFirst: async () => ({
        smsNotificationsEnabled: true,
        smsWeeklyStaffPerformanceTemplate: null,
        defaultCurrency: "GHS",
      }),
    },
    staff: {
      findMany: async () => [
        { id: "staff-1", fullName: "Ellen Doe", phone: "0241234567" },
        { id: "staff-2", fullName: "Abigail Doe", phone: "0241234500" },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `staff-${index + 3}`,
          fullName: `Staff ${index + 3}`,
          phone: `02412345${String(index + 1).padStart(2, "0")}`,
        })),
      ],
    },
    staffDeposit: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, "deposit-ellen");
        return { id: "deposit-ellen", staffId: "staff-1", depositDate: new Date("2026-11-15T00:00:00.000Z") };
      },
    },
    payment: {
      findMany: async ({ where }: { where: { paymentDate: { gte: Date; lt: Date } } }) => {
        assert.equal(where.paymentDate.gte.toISOString(), "2026-11-09T00:00:00.000Z");
        assert.equal(where.paymentDate.lt.toISOString(), "2026-11-16T00:00:00.000Z");
        return [
          { amount: 100, account: { customer: { staffId: "staff-1" } } },
          { amount: 500, account: { customer: { staffId: "staff-2" } } },
        ];
      },
    },
    customerAccount: {
      findMany: async ({ where }: { where: { status: { notIn: string[] }; expectedEndDate?: unknown } }) => {
        assert.deepEqual(where.status.notIn, ["CANCELLED", "CLOSED"]);
        assert.equal(where.expectedEndDate, undefined);
        return Array.from({ length: 8 }, (_, index) => ({
          status: index === 2 ? "DORMANT" : "ACTIVE",
          balance: 100,
          startDate: new Date("2026-11-09T00:00:00.000Z"),
          expectedEndDate: new Date("2026-11-01T23:59:59.999Z"),
          dailyAmount: index === 0 ? 10 : index === 1 ? 40 : 10,
          customer: { staffId: `staff-${index + 1}` },
        }));
      },
    },
    smsNotification: {
      createMany: async ({ data }: { data: Array<{ type: string; dedupeKey: string; recipient: string; body: string; sourceId: string }> }) => {
        messages.push(data[0]);
        return { count: 1 };
      },
      updateMany: async () => ({ count: 1 }),
    },
  };

  const result = await queueWeeklyStaffPerformanceSms(tx as never, "deposit-ellen", new Date("2026-11-16T12:00:00.000Z"));

  assert.deepEqual(result, { queued: 1 });
  assert.deepEqual(messages.map(({ type, dedupeKey, recipient, sourceId }) => ({ type, dedupeKey, recipient, sourceId })), [
    {
      type: "WEEKLY_STAFF_PERFORMANCE",
      dedupeKey: "WEEKLY_STAFF_PERFORMANCE:staff-1:2026-11-09",
      recipient: "+233241234567",
      sourceId: "deposit-ellen",
    },
  ]);
  assert.match(messages[0].body, /last week you collected GHS 100\.00, reaching 142\.86% of target/);
  assert.match(messages[0].body, /ranked 2 of 8 staff/);
});

test("weekly performance SMS is not queued without that staff member's completed-week deposit", async () => {
  const tx = {
    setting: { findFirst: async () => ({ smsNotificationsEnabled: true }) },
    staffDeposit: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, "missing-deposit");
        return null;
      },
    },
  };
  assert.deepEqual(await queueWeeklyStaffPerformanceSms(tx as never, "missing-deposit"), { queued: 0 });
});

test("a deposit dated in the current week cannot trigger a previous-week SMS", async () => {
  const tx = {
    setting: { findFirst: async () => ({ smsNotificationsEnabled: true }) },
    staffDeposit: {
      findUnique: async () => ({ id: "current-week-deposit", staffId: "staff-1", depositDate: new Date("2026-11-16T00:00:00.000Z") }),
    },
  };
  assert.deepEqual(
    await queueWeeklyStaffPerformanceSms(tx as never, "current-week-deposit", new Date("2026-11-16T12:00:00.000Z")),
    { queued: 0 },
  );
});
