"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { ensureSettingsSchema } from "@/lib/settings-schema";
import { isSettingsSection, type SettingsSection } from "@/lib/settings-sections";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
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

type SectionResult = {
  data: Prisma.SettingUncheckedUpdateInput;
  /** Set when the submitted values cannot be saved. */
  error?: string;
};

function companySection(formData: FormData): SectionResult {
  const companyName = text(formData, "companyName");
  const phone = text(formData, "phone");

  if (!companyName || !phone) {
    return { data: {}, error: "missing-company" };
  }

  return {
    data: {
      companyName,
      phone,
      tradingName: optionalText(formData, "tradingName"),
      logoUrl: optionalText(formData, "logoUrl"),
      tagline: text(formData, "tagline") || "Pay Small. Own Big.",
      whatsapp: optionalText(formData, "whatsapp"),
      email: optionalText(formData, "email"),
      website: optionalText(formData, "website"),
      address: optionalText(formData, "address"),
      gpsAddress: optionalText(formData, "gpsAddress"),
      businessRegistrationNumber: optionalText(formData, "businessRegistrationNumber"),
      taxIdentificationNumber: optionalText(formData, "taxIdentificationNumber"),
    },
  };
}

function operationsSection(formData: FormData): SectionResult {
  const installmentDurationDays = integerValue(formData, "installmentDurationDays");
  const defaultDailyCollection = numberValue(formData, "defaultDailyCollection");
  const administrationFeePercent = numberValue(formData, "administrationFeePercent");
  const refundDeductionPercent = numberValue(formData, "refundDeductionPercent");
  const deliveryTimeAfterCompletionDays = integerValue(formData, "deliveryTimeAfterCompletionDays");
  const procurementThresholdPercent = numberValue(formData, "procurementThresholdPercent");
  const paymentEditWindowHours = integerValue(formData, "paymentEditWindowHours");
  const minimumDeposit = numberValue(formData, "minimumDeposit");
  const staffCodeLength = integerValue(formData, "staffCodeLength");

  if (installmentDurationDays <= 0 || Number.isNaN(installmentDurationDays)) {
    return { data: {}, error: "invalid-duration" };
  }

  if (
    [
      defaultDailyCollection,
      administrationFeePercent,
      refundDeductionPercent,
      procurementThresholdPercent,
      minimumDeposit,
    ].some((value) => Number.isNaN(value) || value < 0)
  ) {
    return { data: {}, error: "invalid-number" };
  }

  if (
    administrationFeePercent > 100 ||
    refundDeductionPercent > 100 ||
    procurementThresholdPercent > 100
  ) {
    return { data: {}, error: "invalid-percent" };
  }

  if (
    paymentEditWindowHours < 3 ||
    paymentEditWindowHours > 16 ||
    Number.isNaN(paymentEditWindowHours)
  ) {
    return { data: {}, error: "invalid-payment-edit-window" };
  }

  if (staffCodeLength < 2 || staffCodeLength > 8 || Number.isNaN(staffCodeLength)) {
    return { data: {}, error: "invalid-staff-code-length" };
  }

  return {
    data: {
      installmentDurationDays,
      defaultDailyCollection,
      administrationFeePercent,
      refundDeductionPercent,
      deliveryTimeAfterCompletionDays: Math.max(0, deliveryTimeAfterCompletionDays || 0),
      procurementThresholdPercent,
      paymentEditWindowHours,
      minimumDeposit,
      defaultCurrency: text(formData, "defaultCurrency") || "GHS",
      receiptPrefix: text(formData, "receiptPrefix") || "GLV/RCPT",
      customerIdPrefix: text(formData, "customerIdPrefix") || "GLV",
      staffCodeLength,
    },
  };
}

function payrollSection(formData: FormData): SectionResult {
  const defaultMonthlySalary = numberValue(formData, "defaultMonthlySalary");
  const commissionPercentage = numberValue(formData, "commissionPercentage");
  const payrollDay = integerValue(formData, "payrollDay");

  if (
    [defaultMonthlySalary, commissionPercentage].some(
      (value) => Number.isNaN(value) || value < 0
    )
  ) {
    return { data: {}, error: "invalid-number" };
  }

  if (commissionPercentage > 100) {
    return { data: {}, error: "invalid-percent" };
  }

  if (payrollDay < 1 || payrollDay > 31 || Number.isNaN(payrollDay)) {
    return { data: {}, error: "invalid-payroll-day" };
  }

  return {
    data: {
      defaultMonthlySalary,
      commissionEnabled: enabled(formData, "commissionEnabled"),
      commissionPercentage,
      payrollDay,
    },
  };
}

function notificationsSection(formData: FormData): SectionResult {
  return {
    data: {
      emailNotificationsEnabled: enabled(formData, "emailNotificationsEnabled"),
      smsNotificationsEnabled: enabled(formData, "smsNotificationsEnabled"),
      whatsappRemindersEnabled: enabled(formData, "whatsappRemindersEnabled"),
    },
  };
}

function securitySection(formData: FormData): SectionResult {
  const passwordLength = integerValue(formData, "passwordLength");
  const sessionTimeoutMinutes = integerValue(formData, "sessionTimeoutMinutes");

  if (passwordLength < 6 || Number.isNaN(passwordLength)) {
    return { data: {}, error: "invalid-password-length" };
  }

  if (sessionTimeoutMinutes < 5 || Number.isNaN(sessionTimeoutMinutes)) {
    return { data: {}, error: "invalid-session-timeout" };
  }

  return {
    data: {
      passwordLength,
      sessionTimeoutMinutes,
      requirePasswordChange: enabled(formData, "requirePasswordChange"),
      twoFactorEnabled: enabled(formData, "twoFactorEnabled"),
      backupDatabaseEnabled: enabled(formData, "backupDatabaseEnabled"),
      exportDatabaseEnabled: enabled(formData, "exportDatabaseEnabled"),
    },
  };
}

function systemSection(formData: FormData): SectionResult {
  return {
    data: {
      currentVersion: text(formData, "currentVersion") || "0.1.0",
      databaseStatus: text(formData, "databaseStatus") || "Configured",
      neonStatus: text(formData, "neonStatus") || "Configured",
      storageUsage: optionalText(formData, "storageUsage"),
      restoreBackupStatus: optionalText(formData, "restoreBackupStatus"),
    },
  };
}

const sectionBuilders: Record<SettingsSection, (formData: FormData) => SectionResult> = {
  company: companySection,
  operations: operationsSection,
  payroll: payrollSection,
  notifications: notificationsSection,
  security: securitySection,
  system: systemSection,
};

export async function updateSettings(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  await ensureSettingsSchema();

  const requestedSection = text(formData, "section");
  const section: SettingsSection = isSettingsSection(requestedSection)
    ? requestedSection
    : "company";
  const returnTo = `/settings?tab=${section}`;

  const { data, error } = sectionBuilders[section](formData);

  if (error) {
    redirect(`${returnTo}&error=${error}`);
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findFirst({ orderBy: { createdAt: "asc" } });

    if (!existing) {
      // Company name and phone are required columns, so the very first save has
      // to come from the company section that actually collects them.
      if (section !== "company") {
        return;
      }

      const created = await tx.setting.create({
        data: data as Prisma.SettingUncheckedCreateInput,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE_SETTINGS",
          entity: "Setting",
          entityId: created.id,
          newValue: JSON.stringify({ section, ...data }),
        },
      });

      return;
    }

    const setting = await tx.setting.update({ where: { id: existing.id }, data });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_SETTINGS",
        entity: "Setting",
        entityId: setting.id,
        oldValue: JSON.stringify(
          Object.fromEntries(
            Object.keys(data).map((key) => [
              key,
              (existing as Record<string, unknown>)[key],
            ])
          )
        ),
        newValue: JSON.stringify({ section, ...data }),
      },
    });
  });

  const settingsExist = await prisma.setting.findFirst({ select: { id: true } });

  if (!settingsExist) {
    redirect(`${returnTo}&error=company-required-first`);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/staff");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  redirect(`${returnTo}&saved=1`);
}
