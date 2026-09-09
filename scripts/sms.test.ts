import assert from "node:assert/strict";
import { test, afterEach, mock } from "node:test";
import { missedPaymentPeriod, normalizeSmsPhone, reachedSmsMilestone, WEEK_MS } from "../lib/sms-rules";
import { sendSms, SmsSendError } from "../lib/sms-provider";
import { renderSmsTemplate, validateSmsTemplate } from "../lib/sms-templates";

afterEach(() => mock.restoreAll());
test("editable SMS templates render allowed placeholders and reject unsafe template syntax", () => {
  assert.equal(renderSmsTemplate("salary", "Paid {{amount}} to {{staffName}}", { amount: "GHS 500.00", staffName: "Ama" }), "Paid GHS 500.00 to Ama");
  assert.throws(() => validateSmsTemplate("salary", "Hello {{customerName}}"), /not available/);
  assert.throws(() => validateSmsTemplate("welcome", "Hello {{customerName}"), /incomplete placeholder/);
  assert.throws(() => validateSmsTemplate("welcome", " "), /cannot be empty/);
});
test("Ghana phones accept local/international formats and reject corrupt input", () => {
  for (const value of ["0241234567", "+233 24 123 4567", "233241234567", "00233241234567"]) assert.equal(normalizeSmsPhone(value), "+233241234567");
  for (const value of [null, "", "024123", "call 0241234567", "23324123456789"]) assert.equal(normalizeSmsPhone(value), null);
});
test("70% boundary handles money precision, jumps and invalid targets", () => {
  assert.equal(reachedSmsMilestone(699.99, 1000), false);
  assert.equal(reachedSmsMilestone(700, 1000), true);
  assert.equal(reachedSmsMilestone(1000, 1000), true);
  assert.equal(reachedSmsMilestone(1, 0), false);
  assert.equal(reachedSmsMilestone(Infinity, 100), false);
});
test("weekly reminder checks dates, backdated entries, balance and lifecycle", () => {
  const start = new Date("2026-09-01T00:00:00Z");
  const account = { status: "ACTIVE", balance: 100, startDate: start, payments: [] };
  assert.equal(missedPaymentPeriod(account, new Date(+start + WEEK_MS - 1)), null);
  assert.ok(missedPaymentPeriod(account, new Date(+start + WEEK_MS))?.endsWith(":1"));
  assert.ok(missedPaymentPeriod(account, new Date(+start + WEEK_MS * 2))?.endsWith(":2"));
  for (const status of ["COMPLETED", "CANCELLED", "CLOSED", "DORMANT", "SUSPENDED", "ARCHIVED"]) assert.equal(missedPaymentPeriod({ ...account, status }, new Date(+start + WEEK_MS)), null);
  assert.equal(missedPaymentPeriod({ ...account, balance: 0 }, new Date(+start + WEEK_MS)), null);
  assert.equal(missedPaymentPeriod({ ...account, payments: [{ id: "p", paymentDate: start, createdAt: new Date(+start + WEEK_MS) }] }, new Date(+start + WEEK_MS)), null);
});
test("BMS payload and campaign acceptance follow the documented contract", async () => {
  process.env.MNOTIFY_API_KEY = "test-only-key";
  process.env.MNOTIFY_SENDER_ID = "GODS LOVE V";
  mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(new URL(url).hostname, "api.mnotify.com");
    assert.equal(new URL(url).searchParams.get("key"), "test-only-key");
    assert.deepEqual(JSON.parse(String(options.body)), { recipient: ["0241234567"], sender: "GODS LOVE V", message: "Test", is_schedule: false, schedule_date: "" });
    return Response.json({ status: "success", summary: { _id: "campaign", total_sent: 1, total_rejected: 0 } });
  });
  assert.equal(await sendSms("+233241234567", "Test"), "campaign");
});
test("BMS timeout, rejection, throttle and malformed success are handled safely", async () => {
  process.env.MNOTIFY_API_KEY = "test-only-key";
  process.env.MNOTIFY_SENDER_ID = "GODS LOVE V";
  for (const [response, outcome] of [
    [Response.json({ status: "error" }), "FAILED"], [new Response("", { status: 429 }), "PENDING"],
    [new Response("", { status: 503 }), "UNKNOWN"], [Response.json({ status: "success", summary: { total_sent: 0 } }), "UNKNOWN"], [null, "UNKNOWN"],
  ] as const) {
    mock.method(globalThis, "fetch", async () => { if (!response) throw new Error("secret URL"); return response; });
    await assert.rejects(sendSms("0241234567", "Test"), (error: unknown) => error instanceof SmsSendError && error.outcome === outcome && !error.message.includes("secret URL"));
    mock.restoreAll();
  }
});
test("event queue respects toggle and unique event keys; missing staff phone is actionable", async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
  // Plain delegate stubs avoid Prisma's dynamic proxy descriptors and any DB connection.
  (globalThis as unknown as { prisma: unknown }).prisma = {
    setting: { findFirst() {} }, customerAccount: { findUnique() {}, findUniqueOrThrow() {} },
    staffSalaryPayment: { findUnique() {} },
    smsNotification: { createMany() {}, findMany() {}, updateMany() {}, update() {} },
  };
  const { prisma } = await import("../lib/prisma");
  const { queueAccountSms, queueSalarySms } = await import("../lib/sms-notifications");
  let enabled = false;
  mock.method(prisma.setting, "findFirst", async () => ({ smsNotificationsEnabled: enabled, defaultCurrency: "GHS" }));
  mock.method(prisma.customerAccount, "findUnique", async () => ({ id: "a", status: "ACTIVE", targetAmount: 100, totalPaid: 70, balance: 30, dailyAmount: 5, startDate: new Date(), customer: { fullName: "Test", phone: "0241234567" }, product: { name: "Test product" } }));
  mock.method(prisma.staffSalaryPayment, "findUnique", async () => ({ id: "s", amount: 500, salaryMonth: new Date(), paymentDate: new Date(), staff: { fullName: "Test", phone: null } }));
  const rows = new Map<string, { status: string }>();
  const rearm = mock.method(prisma.smsNotification, "updateMany", async ({ where }: { where: { status: string; dedupeKey: string } }) => {
    assert.equal(where.status, "CANCELLED"); assert.equal(where.dedupeKey, "PROGRESS_70:a"); return { count: 0 };
  });
  mock.method(prisma.smsNotification, "createMany", async ({ data, skipDuplicates }: { data: Array<{ dedupeKey: string; status: string }>; skipDuplicates: boolean }) => {
    assert.equal(skipDuplicates, true);
    if (rows.has(data[0].dedupeKey)) return { count: 0 };
    rows.set(data[0].dedupeKey, data[0]); return { count: 1 };
  });
  await queueAccountSms(prisma, "a", "WELCOME"); assert.equal(rows.size, 0);
  enabled = true;
  await queueAccountSms(prisma, "a", "WELCOME"); await queueAccountSms(prisma, "a", "WELCOME");
  await queueAccountSms(prisma, "a", "PROGRESS_70"); await queueSalarySms(prisma, "s");
  assert.equal(rows.size, 3); assert.equal(rows.get("SALARY:s")?.status, "FAILED");
  assert.equal(rearm.mock.callCount(), 1);
});
test("dispatch suppresses completed reminders and concurrent duplicate workers", async () => {
  const { prisma } = await import("../lib/prisma");
  const { dispatchDueSms } = await import("../lib/sms-notifications");
  mock.method(prisma.setting, "findFirst", async () => ({ smsNotificationsEnabled: true }));
  mock.method(prisma.smsNotification, "findMany", async () => [{ id: "m", type: "MISSED_WEEK", sourceId: "a", dedupeKey: "old", attempts: 0, body: "Test" }]);
  let claimed = false;
  mock.method(prisma.smsNotification, "updateMany", async ({ where }: { where: { id?: string } }) => {
    if (!where.id || claimed) return { count: 0 }; claimed = true; return { count: 1 };
  });
  mock.method(prisma.customerAccount, "findUnique", async () => ({ status: "COMPLETED", balance: 0, startDate: new Date(), customer: { phone: "0241234567" }, payments: [] }));
  const update = mock.method(prisma.smsNotification, "update", async ({ data }: { data: { status: string } }) => { assert.equal(data.status, "CANCELLED"); });
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("Must not send"); });
  await Promise.all([dispatchDueSms(), dispatchDueSms()]);
  assert.equal(fetch.mock.callCount(), 0); assert.equal(update.mock.callCount(), 1);
});
