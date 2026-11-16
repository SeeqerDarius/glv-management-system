import assert from "node:assert/strict";
import { test } from "node:test";
import { queueWeeklyStaffPerformanceSms } from "../lib/sms-notifications";

test("late prior-week deposits queue SMS and rank by recorded deposit totals", async () => {
  const messages: Array<{ type: string; dedupeKey: string; recipient: string; body: string }> = [];
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
      ],
    },
    staffDeposit: {
      findMany: async ({ where }: { where: { createdAt?: unknown; depositDate: { gte?: Date; lt?: Date } } }) => {
        if (where.createdAt) return [{ depositDate: new Date("2026-11-08T00:00:00.000Z") }];
        if (where.depositDate.gte?.toISOString() === "2026-11-09T00:00:00.000Z") return [];
        assert.equal(where.depositDate.gte?.toISOString(), "2026-11-02T00:00:00.000Z");
        assert.equal(where.depositDate.lt?.toISOString(), "2026-11-09T00:00:00.000Z");
        return [
          { staffId: "staff-1", amount: 100 },
          { staffId: "staff-2", amount: 200 },
        ];
      },
    },
    payment: { findMany: async () => [] },
    customerAccount: {
      findMany: async () => [
        {
          startDate: new Date("2026-11-02T00:00:00.000Z"),
          expectedEndDate: new Date("2026-11-30T23:59:59.999Z"),
          dailyAmount: 10,
          customer: { staffId: "staff-1" },
        },
        {
          startDate: new Date("2026-11-02T00:00:00.000Z"),
          expectedEndDate: new Date("2026-11-30T23:59:59.999Z"),
          dailyAmount: 40,
          customer: { staffId: "staff-2" },
        },
      ],
    },
    smsNotification: {
      createMany: async ({ data }: { data: Array<{ type: string; dedupeKey: string; recipient: string; body: string }> }) => {
        messages.push(data[0]);
        return { count: 1 };
      },
      updateMany: async () => ({ count: 1 }),
    },
  };

  const result = await queueWeeklyStaffPerformanceSms(
    tx as never,
    new Date("2026-11-16T12:00:00.000Z"),
  );

  assert.deepEqual(result, { queued: 2 });
  assert.deepEqual(messages.map(({ type, dedupeKey, recipient }) => ({ type, dedupeKey, recipient })), [
    {
      type: "WEEKLY_STAFF_PERFORMANCE",
      dedupeKey: "WEEKLY_STAFF_PERFORMANCE:staff-1:2026-11-02",
      recipient: "+233241234567",
    },
    {
      type: "WEEKLY_STAFF_PERFORMANCE",
      dedupeKey: "WEEKLY_STAFF_PERFORMANCE:staff-2:2026-11-02",
      recipient: "+233241234500",
    },
  ]);
  assert.match(messages[0].body, /deposits totaling GHS 100\.00, reaching 142\.86% of target/);
  assert.match(messages[0].body, /ranked 1 of 2 staff/);
  assert.match(messages[1].body, /deposits totaling GHS 200\.00, reaching 71\.43% of target/);
  assert.match(messages[1].body, /ranked 2 of 2 staff/);
});
