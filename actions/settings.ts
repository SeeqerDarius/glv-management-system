"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return { id: session.user.id };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? value : Number.NaN;
}

function integerValue(formData: FormData, key: string) {
  const value = Number.parseInt(text(formData, key), 10);
  return Number.isFinite(value) ? value : Number.NaN;
}

function enabled(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export async function updateSettings(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  const companyName = text(formData, "companyName");
  const phone = text(formData, "phone");
  const installmentDurationDays = integerValue(formData, "installmentDurationDays");
  const defaultDailyCollection = numberValue(formData, "defaultDailyCollection");
  const administrationFeePercent = numberValue(formData, "administrationFeePercent");
  const refundDeductionPercent = numberValue(formData, "refundDeductionPercent");
  const deliveryTimeAfterCompletionDays = integerValue(formData, "deliveryTimeAfterCompletionDays");
  const procurementThresholdPercent = numberValue(formData, "procurementThresholdPercent");
  const minimumDeposit = numberValue(formData, "minimumDeposit");
  const defaultMonthlySalary = numberValue(formData, "defaultMonthlySalary");
  const commissionPercentage = numberValue(formData, "commissionPercentage");
  const payrollDay = integerValue(formData, "payrollDay");
  const staffCodeLength = integerValue(formData, "staffCodeLength");
  const passwordLength = integerValue(formData, "passwordLength");
  const sessionTimeoutMinutes = integerValue(formData, "sessionTimeoutMinutes");

  if (!companyName || !phone) redirect("/settings?error=missing-company");
  if (installmentDurationDays <= 0 || Number.isNaN(installmentDurationDays)) {
    redirect("/settings?error=invalid-duration");
  }
  if (
    [defaultDailyCollection, administrationFeePercent, refundDeductionPercent, procurementThresholdPercent, minimumDeposit, defaultMonthlySalary, commissionPercentage].some(
      (value) => Number.isNaN(value) || value < 0
    )
  ) {
    redirect("/settings?error=invalid-number");
  }
  if (administrationFeePercent > 100 || refundDeductionPercent > 100 || procurementThresholdPercent > 100 || commissionPercentage > 100) {
    redirect("/settings?error=invalid-percent");
  }
  if (payrollDay < 1 || payrollDay > 31 || Number.isNaN(payrollDay)) {
    redirect("/settings?error=invalid-payroll-day");
  }
  if (staffCodeLength < 2 || staffCodeLength > 8 || Number.isNaN(staffCodeLength)) {
    redirect("/settings?error=invalid-staff-code-length");
  }
  if (passwordLength < 6 || Number.isNaN(passwordLength)) {
    redirect("/settings?error=invalid-password-length");
  }
  if (sessionTimeoutMinutes < 5 || Number.isNaN(sessionTimeoutMinutes)) {
    redirect("/settings?error=invalid-session-timeout");
  }

  const data = {
    companyName,
    tradingName: optionalText(formData, "tradingName"),
    logoUrl: optionalText(formData, "logoUrl"),
    tagline: text(formData, "tagline") || "Pay Small. Own Big.",
    phone,
    whatsapp: optionalText(formData, "whatsapp"),
    email: optionalText(formData, "email"),
    website: optionalText(formData, "website"),
    address: optionalText(formData, "address"),
    gpsAddress: optionalText(formData, "gpsAddress"),
    businessRegistrationNumber: optionalText(formData, "businessRegistrationNumber"),
    taxIdentificationNumber: optionalText(formData, "taxIdentificationNumber"),
    installmentDurationDays,
    defaultDailyCollection,
    administrationFeePercent,
    refundDeductionPercent,
    deliveryTimeAfterCompletionDays: Math.max(0, deliveryTimeAfterCompletionDays || 0),
    procurementThresholdPercent,
    minimumDeposit,
    defaultCurrency: text(formData, "defaultCurrency") || "GHS",
    defaultMonthlySalary,
    commissionEnabled: enabled(formData, "commissionEnabled"),
    commissionPercentage,
    payrollDay,
    receiptPrefix: text(formData, "receiptPrefix") || "GLV/RCPT",
    customerIdPrefix: text(formData, "customerIdPrefix") || "GLV",
    staffCodeLength,
    passwordLength,
    sessionTimeoutMinutes,
    requirePasswordChange: enabled(formData, "requirePasswordChange"),
    twoFactorEnabled: enabled(formData, "twoFactorEnabled"),
    backupDatabaseEnabled: enabled(formData, "backupDatabaseEnabled"),
    exportDatabaseEnabled: enabled(formData, "exportDatabaseEnabled"),
    emailNotificationsEnabled: enabled(formData, "emailNotificationsEnabled"),
    smsNotificationsEnabled: enabled(formData, "smsNotificationsEnabled"),
    whatsappRemindersEnabled: enabled(formData, "whatsappRemindersEnabled"),
    theme: text(formData, "theme") || "light",
    primaryColor: text(formData, "primaryColor") || "#84cc16",
    secondaryColor: text(formData, "secondaryColor") || "#111827",
    dashboardCards: text(formData, "dashboardCards") || "standard",
    loadingAnimation: text(formData, "loadingAnimation") || "glv",
    currentVersion: text(formData, "currentVersion") || "0.1.0",
    databaseStatus: text(formData, "databaseStatus") || "Configured",
    neonStatus: text(formData, "neonStatus") || "Configured",
    storageUsage: optionalText(formData, "storageUsage"),
    restoreBackupStatus: optionalText(formData, "restoreBackupStatus"),
  };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findFirst({ orderBy: { createdAt: "asc" } });
    const setting = existing
      ? await tx.setting.update({ where: { id: existing.id }, data })
      : await tx.setting.create({ data });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_SETTINGS",
        entity: "Setting",
        entityId: setting.id,
        oldValue: existing ? JSON.stringify(existing) : null,
        newValue: JSON.stringify(data),
      },
    });
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
