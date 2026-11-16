import assert from "node:assert/strict";
import { test } from "node:test";
import { queueWeeklyStaffPerformanceSms } from "../lib/sms-notifications";

test("a late prior-week staff deposit queues performance SMS on a weekday", async () => {
  const messages: Array<{ type: string; dedupeKey: string; recipient: string }> = [];
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
          { staffId: "staff-2", amount: 100 },
        ];
      },
    },
    payment: { findMany: async () => [] },
    customerAccount: { findMany: async () => [] },
    smsNotification: {
      createMany: async ({ data }: { data: Array<{ type: string; dedupeKey: string; recipient: string }> }) => {
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
});
