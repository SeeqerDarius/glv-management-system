import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { missedPaymentPeriod, normalizeSmsPhone, reachedSmsMilestone } from "./sms-rules";
import { sendSms, SmsSendError, smsProviderConfigured } from "./sms-provider";

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
    ? `GLV: Welcome ${account.customer.fullName}! Your ${account.product.name} plan starts ${account.startDate.toISOString().slice(0, 10)}. Target: ${money(account.targetAmount, settings.defaultCurrency)}. Daily payment: ${money(account.dailyAmount, settings.defaultCurrency)}. Pay Small. Own Big.`
    : `GLV: Well done ${account.customer.fullName}! You have paid at least 70% toward ${account.product.name}. Paid: ${money(account.totalPaid, settings.defaultCurrency)}. Balance: ${money(account.balance, settings.defaultCurrency)}. Thank you!`;
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
    body: `GLV: Hello ${payment.staff.fullName}, your salary payment of ${money(payment.amount, settings.defaultCurrency)} for ${payment.salaryMonth.toISOString().slice(0, 7)} was recorded on ${payment.paymentDate.toISOString().slice(0, 10)}. Thank you for your work.` });
}

const accountInclude = { customer: true, payments: { orderBy: { createdAt: "desc" as const }, take: 1 } };

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
        body: `GLV: Hello ${account.customer.fullName}, we have not recorded a payment on your plan for at least 7 days. Balance: ${money(account.balance, settings.defaultCurrency)}. Please contact your collector to arrange payment. If you have paid, contact GLV to reconcile your record.` });
      queued += result.count;
    }
    cursor = accounts[accounts.length - 1].id;
  }
  return { queued };
}

async function currentRecipient(message: { type: string; sourceId: string; dedupeKey: string }) {
  if (message.type === "SALARY") {
    const payment = await prisma.staffSalaryPayment.findUnique({ where: { id: message.sourceId }, include: { staff: true } });
    return payment ? { phone: payment.staff.phone } : null;
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
