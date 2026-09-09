import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missedPaymentPeriod, normalizeSmsPhone, reachedSmsMilestone } from "./sms-rules";
import { sendSms, SmsSendError, smsProviderConfigured } from "./sms-provider";
import { renderSmsTemplate, smsFirstName } from "./sms-templates";

type Client = Prisma.TransactionClient;
const money = (value: number, currency = "GHS") => `${currency} ${value.toFixed(2)}`;

async function queue(tx: Client, data: {
  type: string; sourceId: string; dedupeKey: string; recipient: string | null; body: string;
  scheduledAt?: Date;
}) {
  const recipient = normalizeSmsPhone(data.recipient);
  return tx.smsNotification.createMany({
    data: [{ ...data, recipient: recipient ?? data.recipient ?? "",
      status: recipient ? "PENDING" : "FAILED",
      lastError: recipient ? null : "Missing or invalid phone number. Correct the record before retrying." }],
    skipDuplicates: true,
  });
}

export async function queueAccountSms(tx: Client, accountId: string, type: "WELCOME" | "PROGRESS_70") {
  const settings = await tx.setting.findFirst();
  if (!settings?.smsNotificationsEnabled) return;
  const account = await tx.customerAccount.findUnique({ where: { id: accountId }, include: { customer: true, product: true } });
  if (!account || ["CLOSED", "CANCELLED", "ARCHIVED", "SUSPENDED"].includes(account.status)) return;
  if (type === "PROGRESS_70" && !reachedSmsMilestone(account.totalPaid, account.targetAmount)) return;
  const body = type === "WELCOME"
    ? renderSmsTemplate("welcome", settings.smsWelcomeTemplate, {
      customerName: smsFirstName(account.customer.fullName), productName: account.product.name,
      startDate: account.startDate.toISOString().slice(0, 10),
      targetAmount: money(account.targetAmount, settings.defaultCurrency),
      dailyAmount: money(account.dailyAmount, settings.defaultCurrency),
    })
    : renderSmsTemplate("progress70", settings.smsProgress70Template, {
      customerName: smsFirstName(account.customer.fullName), productName: account.product.name,
      paidAmount: money(account.totalPaid, settings.defaultCurrency),
      balance: money(account.balance, settings.defaultCurrency),
    });
  await queue(tx, { type, sourceId: account.id, dedupeKey: `${type}:${account.id}`,
    recipient: account.customer.phone, body,
    scheduledAt: type === "WELCOME" ? new Date(Math.max(Date.now(), account.startDate.getTime())) : new Date() });
  if (type === "PROGRESS_70") {
    // A corrected payment can drop below 70% before dispatch, cancelling the notice.
    // Permit a later real crossing to re-arm it; accepted/unknown messages stay untouched.
    const recipient = normalizeSmsPhone(account.customer.phone);
    await tx.smsNotification.updateMany({
      where: { dedupeKey: `${type}:${account.id}`, status: "CANCELLED" },
      data: { status: recipient ? "PENDING" : "FAILED", recipient: recipient ?? "", body,
        attempts: 0, scheduledAt: new Date(), lastError: recipient ? null : "Missing or invalid phone number." },
    });
  }
}

export async function queueSalarySms(tx: Client, paymentId: string) {
  const settings = await tx.setting.findFirst();
  if (!settings?.smsNotificationsEnabled) return;
  const payment = await tx.staffSalaryPayment.findUnique({ where: { id: paymentId }, include: { staff: true } });
  if (!payment) return;
  await queue(tx, { type: "SALARY", sourceId: payment.id, dedupeKey: `SALARY:${payment.id}`,
    recipient: payment.staff.phone,
    body: renderSmsTemplate("salary", settings.smsSalaryTemplate, {
      staffName: smsFirstName(payment.staff.fullName), amount: money(payment.amount, settings.defaultCurrency),
      salaryMonth: payment.salaryMonth.toISOString().slice(0, 7),
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    }) });
}

const accountInclude = { customer: true, product: true, payments: { orderBy: { createdAt: "desc" as const }, take: 1 } };

export async function queueMissedPaymentSms(now = new Date()) {
  const settings = await prisma.setting.findFirst();
  if (!settings?.smsNotificationsEnabled) return { queued: 0 };
  let cursor: string | undefined;
  let queued = 0;
  // Bounded pages keep scans from loading the entire customer database at once.
  for (;;) {
    const accounts = await prisma.customerAccount.findMany({
      where: { status: { in: ["ACTIVE", "OVERDUE"] }, balance: { gt: 0 }, startDate: { lte: now } },
      include: accountInclude, orderBy: { id: "asc" }, take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!accounts.length) break;
    for (const account of accounts) {
      const period = missedPaymentPeriod(account, now);
      if (!period) continue;
      const result = await queue(prisma, { type: "MISSED_WEEK", sourceId: account.id,
        dedupeKey: `MISSED_WEEK:${account.id}:${period}`, recipient: account.customer.phone,
        body: renderSmsTemplate("missedWeek", settings.smsMissedWeekTemplate, {
          customerName: smsFirstName(account.customer.fullName), productName: account.product.name,
          balance: money(account.balance, settings.defaultCurrency),
          daysSincePayment: String(Math.max(7, Math.floor((now.getTime() - (account.payments[0]?.createdAt ?? account.startDate).getTime()) / 86_400_000))),
        }) });
      queued += result.count;
    }
    cursor = accounts[accounts.length - 1].id;
  }
  return { queued };
}

function weekRange(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function queueWeeklyCustomerSummarySms(tx: Client, staffId: string, depositDate: Date) {
  const settings = await tx.setting.findFirst();
  if (!settings?.smsNotificationsEnabled) return { queued: 0 };
  const staff = await tx.staff.findUnique({ where: { id: staffId }, select: { fullName: true } });
  if (!staff) return { queued: 0 };
  const { start, end } = weekRange(depositDate);
  const payments = await tx.payment.findMany({
    where: { paymentDate: { gte: start, lte: end }, account: { customer: { staffId } } },
    select: { amount: true, account: { select: { customer: { select: { id: true, fullName: true, phone: true } } } } },
  });
  const customers = new Map<string, { fullName: string; phone: string | null; amount: number }>();
  for (const payment of payments) {
    const customer = payment.account.customer;
    const current = customers.get(customer.id);
    customers.set(customer.id, { fullName: customer.fullName, phone: customer.phone, amount: (current?.amount ?? 0) + payment.amount });
  }
  let queued = 0;
  const weekKey = start.toISOString().slice(0, 10);
  for (const [customerId, customer] of customers) {
    const body = renderSmsTemplate("weeklySummary", settings.smsWeeklySummaryTemplate, {
      customerName: smsFirstName(customer.fullName), weeklyAmount: money(customer.amount, settings.defaultCurrency),
      weekStart: weekKey, weekEnd: end.toISOString().slice(0, 10), staffName: smsFirstName(staff.fullName),
    });
    const dedupeKey = `WEEKLY_SUMMARY:${staffId}:${customerId}:${weekKey}`;
    const result = await queue(tx, { type: "WEEKLY_SUMMARY", sourceId: customerId, dedupeKey, recipient: customer.phone, body });
    queued += result.count;
    const recipient = normalizeSmsPhone(customer.phone);
    await tx.smsNotification.updateMany({
      where: { dedupeKey, status: { in: ["PENDING", "FAILED"] } },
      data: { recipient: recipient ?? "", body, status: recipient ? "PENDING" : "FAILED",
        lastError: recipient ? null : "Missing or invalid phone number. Correct the record before retrying." },
    });
  }
  return { queued };
}

async function currentRecipient(message: { type: string; sourceId: string; dedupeKey: string }) {
  if (message.type === "SALARY") {
    const payment = await prisma.staffSalaryPayment.findUnique({ where: { id: message.sourceId }, include: { staff: true } });
    return payment ? { phone: payment.staff.phone } : null;
  }
  if (message.type === "WEEKLY_SUMMARY") {
    const staffId = message.dedupeKey.split(":")[1];
    const customer = await prisma.customer.findUnique({ where: { id: message.sourceId }, select: { phone: true, staffId: true } });
    return customer && customer.staffId === staffId ? { phone: customer.phone } : null;
  }
  const account = await prisma.customerAccount.findUnique({ where: { id: message.sourceId }, include: accountInclude });
  if (!account || ["CLOSED", "CANCELLED", "ARCHIVED", "SUSPENDED"].includes(account.status)) return null;
  if (message.type === "PROGRESS_70" && !reachedSmsMilestone(account.totalPaid, account.targetAmount)) return null;
  if (message.type === "MISSED_WEEK") {
    const period = missedPaymentPeriod(account);
    if (!period || message.dedupeKey !== `MISSED_WEEK:${account.id}:${period}`) return null;
  }
  return { phone: account.customer.phone };
}

export async function dispatchDueSms(limit = 20) {
  const settings = await prisma.setting.findFirst();
  if (!settings?.smsNotificationsEnabled || !smsProviderConfigured()) return { accepted: 0, paused: true };
  await prisma.smsNotification.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
    data: { status: "UNKNOWN", lastError: "Worker interrupted. Check provider logs before retrying." },
  });
  const due = await prisma.smsNotification.findMany({
    where: { status: "PENDING", scheduledAt: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { scheduledAt: "asc" }, take: limit,
  });
  let accepted = 0;
  for (let offset = 0; offset < due.length; offset += 5) {
    await Promise.all(due.slice(offset, offset + 5).map(async (message) => {
    const claimed = await prisma.smsNotification.updateMany({ where: { id: message.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } } });
    if (!claimed.count) return;
    try {
      const recipient = await currentRecipient(message);
      if (!recipient) {
        await prisma.smsNotification.update({ where: { id: message.id }, data: { status: "CANCELLED", lastError: "Source deleted or notification no longer applicable." } });
        return;
      }
      const phone = normalizeSmsPhone(recipient.phone);
      if (!phone) throw new SmsSendError("Missing or invalid phone number.", "FAILED");
      // Refresh financial amounts immediately before dispatch, after corrections.
      let body = message.body;
      if (message.type === "PROGRESS_70" || message.type === "MISSED_WEEK") {
        const account = await prisma.customerAccount.findUniqueOrThrow({ where: { id: message.sourceId } });
        body = body.replace(/Balance: [^.]+\.\d{2}/, `Balance: ${money(account.balance, settings.defaultCurrency)}`)
          .replace(/Paid: [^.]+\.\d{2}/, `Paid: ${money(account.totalPaid, settings.defaultCurrency)}`);
      }
      const providerId = await sendSms(phone, body);
      await prisma.smsNotification.update({ where: { id: message.id },
        data: { status: "ACCEPTED", recipient: phone, body, providerId, sentAt: new Date(), lastError: null } });
      accepted++;
    } catch (error) {
      const outcome = error instanceof SmsSendError ? error.outcome : "UNKNOWN";
      await prisma.smsNotification.update({ where: { id: message.id }, data: {
        status: outcome === "PENDING" && message.attempts >= 4 ? "FAILED" : outcome,
        lastError: error instanceof SmsSendError ? error.message : "Dispatch interrupted. Check provider logs before retrying.",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      } });
    }
    }));
  }
  return { accepted, paused: false };
}
