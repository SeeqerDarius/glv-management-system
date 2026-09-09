"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { dispatchDueSms } from "@/lib/sms-notifications";

export async function retryFailedSms(form: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) throw new Error("Unauthorized");
  const userId = session.user.id;
  const id = String(form.get("id") ?? "");
  await prisma.$transaction(async (tx) => {
    const changed = await tx.smsNotification.updateMany({ where: { id, status: "FAILED" },
      data: { status: "PENDING", scheduledAt: new Date(), attempts: 0, lastError: null } });
    if (changed.count) await tx.auditLog.create({ data: { userId,
      action: "RETRY_SMS", entity: "SmsNotification", entityId: id } });
  });
  after(() => dispatchDueSms().catch(() => console.error("SMS retry dispatch failed.")));
  revalidatePath("/settings/sms");
}

export async function updateSmsConfiguration(form: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) throw new Error("Unauthorized");
  const userId = session.user.id;
  const enabled = form.get("smsNotificationsEnabled") === "on";
  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!existing) throw new Error("Company settings are not configured.");
    await tx.setting.update({ where: { id: existing.id }, data: { smsNotificationsEnabled: enabled } });
    await tx.auditLog.create({ data: {
      userId, action: enabled ? "ENABLE_SMS_NOTIFICATIONS" : "DISABLE_SMS_NOTIFICATIONS",
      entity: "Setting", entityId: existing.id,
      oldValue: JSON.stringify({ smsNotificationsEnabled: existing.smsNotificationsEnabled }),
      newValue: JSON.stringify({ smsNotificationsEnabled: enabled }),
    } });
  });
  revalidatePath("/settings/sms");
  revalidatePath("/settings");
}
