"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { dispatchDueSms } from "@/lib/sms-notifications";
import { SMS_TEMPLATE_DEFINITIONS, type SmsTemplateKey, validateSmsTemplate } from "@/lib/sms-templates";

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

const templateFields: Record<SmsTemplateKey, string> = {
  salary: "smsSalaryTemplate", welcome: "smsWelcomeTemplate",
  progress70: "smsProgress70Template", missedWeek: "smsMissedWeekTemplate",
  weeklySummary: "smsWeeklySummaryTemplate",
};

export async function updateSmsTemplates(form: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) throw new Error("Unauthorized");
  const userId = session.user.id;
  const resetAll = form.get("intent") === "reset";
  const templates = Object.fromEntries(Object.entries(templateFields).map(([key, field]) => {
    const templateKey = key as SmsTemplateKey;
    const value = resetAll ? SMS_TEMPLATE_DEFINITIONS[templateKey].defaultTemplate : String(form.get(`${templateKey}Template`) ?? "");
    return [field, validateSmsTemplate(templateKey, value)];
  }));
  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findFirst({ orderBy: { createdAt: "asc" } });
    if (!existing) throw new Error("Company settings are not configured.");
    await tx.setting.update({ where: { id: existing.id }, data: templates });
    await tx.auditLog.create({ data: {
      userId, action: resetAll ? "RESET_SMS_TEMPLATES" : "UPDATE_SMS_TEMPLATES",
      entity: "Setting", entityId: existing.id,
      newValue: JSON.stringify({ templates: Object.keys(templateFields) }),
    } });
  });
  revalidatePath("/settings/sms");
}
