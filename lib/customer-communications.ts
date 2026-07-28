import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CommunicationClient = Pick<
  Prisma.TransactionClient,
  "customerMessage" | "setting"
>;

type RecipientCustomer = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

type CommunicationSettings = {
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  whatsappRemindersEnabled: boolean;
};

function selectCommunicationChannel({
  customer,
  setting,
  type,
}: {
  customer: RecipientCustomer;
  setting: CommunicationSettings | null;
  type: string;
}) {
  const email =
    setting?.emailNotificationsEnabled && customer.email
      ? { channel: "EMAIL", recipient: customer.email }
      : null;
  const whatsapp =
    setting?.whatsappRemindersEnabled && customer.phone
      ? { channel: "WHATSAPP", recipient: customer.phone }
      : null;
  const sms =
    setting?.smsNotificationsEnabled && customer.phone
      ? { channel: "SMS", recipient: customer.phone }
      : null;

  if (type === "PAYMENT_RECEIPT") {
    return whatsapp || sms || email;
  }

  return email || whatsapp || sms;
}

export async function queueCustomerCommunication({
  client = prisma,
  customer,
  accountId,
  documentId,
  type,
  subject,
  body,
  scheduledAt = new Date(),
  dedupeBase,
  documentUrl,
}: {
  client?: CommunicationClient;
  customer: RecipientCustomer;
  accountId?: string | null;
  documentId?: string | null;
  type: string;
  subject: string;
  body: string;
  scheduledAt?: Date;
  dedupeBase: string;
  documentUrl?: string | null;
}) {
  const setting = await client.setting.findFirst({
    select: {
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      whatsappRemindersEnabled: true,
    },
  });
  const preferred = selectCommunicationChannel({ customer, setting, type });
  const channels = preferred ? [preferred] : [];

  for (const item of channels) {
    const channelBody =
      item.channel === "EMAIL" || !documentUrl
        ? body
        : `${subject}\n\nView or download your document securely: ${documentUrl}\n\nPlease contact GLV if you did not expect this message.`;
    await client.customerMessage.upsert({
      where: { dedupeKey: `${dedupeBase}:${item.channel}` },
      update: {
        recipient: item.recipient,
        subject,
        body: channelBody,
        scheduledAt,
        documentId: documentId ?? null,
        lastError: null,
      },
      create: {
        type,
        channel: item.channel,
        recipient: item.recipient,
        subject,
        body: channelBody,
        scheduledAt,
        dedupeKey: `${dedupeBase}:${item.channel}`,
        customerId: customer.id,
        accountId: accountId ?? null,
        documentId: documentId ?? null,
      },
    });
  }

  return channels.length;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("233")) return `+${digits}`;
  if (digits.startsWith("0")) return `+233${digits.slice(1)}`;
  return value.startsWith("+") ? value : `+${digits}`;
}

async function sendEmail(message: {
  recipient: string;
  subject: string | null;
  body: string;
  dedupeKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CUSTOMER_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email provider is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.dedupeKey,
    },
    body: JSON.stringify({
      from,
      to: [message.recipient],
      subject: message.subject || "Message from GLV",
      html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${message.body.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div>`,
    }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(result.message || "Email delivery failed.");
  return result.id ?? null;
}

async function sendTwilio(message: {
  channel: string;
  recipient: string;
  body: string;
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from =
    message.channel === "WHATSAPP"
      ? process.env.TWILIO_WHATSAPP_FROM
      : process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) {
    throw new Error(`${message.channel} provider is not configured.`);
  }
  const to = normalizePhone(message.recipient);
  const form = new URLSearchParams({
    From: message.channel === "WHATSAPP" ? `whatsapp:${from.replace("whatsapp:", "")}` : from,
    To: message.channel === "WHATSAPP" ? `whatsapp:${to}` : to,
    Body: message.body,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    }
  );
  const result = (await response.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(result.message || "Message delivery failed.");
  return result.sid ?? null;
}

export async function dispatchDueCustomerMessages(limit = 20) {
  const due = await prisma.customerMessage.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    include: {
      customer: {
        select: { email: true, phone: true },
      },
    },
  });
  let sent = 0;
  for (const message of due) {
    const claimed = await prisma.customerMessage.updateMany({
      where: { id: message.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const providerId =
        message.channel === "EMAIL"
          ? await sendEmail(message)
          : await sendTwilio(message);
      await prisma.customerMessage.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId,
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Delivery failed.";
      const notConfigured = detail.includes("not configured");
      await prisma.customerMessage.update({
        where: { id: message.id },
        data: {
          status: "PENDING",
          lastError: detail,
          scheduledAt: new Date(
            Date.now() + (notConfigured ? 6 : 1) * 60 * 60 * 1000
          ),
        },
      });
    }
  }
  return { checked: due.length, sent };
}
