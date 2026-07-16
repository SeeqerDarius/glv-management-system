"use server";

import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  backupTableOrder,
  reviveBackupRows,
  type DatabaseBackup,
} from "@/lib/database-backup";
import { isSuperAdminRole } from "@/lib/roles";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requireSuperAdminWithPassword(formData: FormData) {
  const session = await auth();
  const adminPassword = clean(formData.get("adminPassword"));

  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  if (!adminPassword) {
    redirect("/settings?error=admin-password-required");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });
  const passwordValid = user
    ? await bcrypt.compare(adminPassword, user.password)
    : false;

  if (!passwordValid) {
    redirect("/settings?error=invalid-admin-password");
  }

  return session.user.id;
}

function getBackupFile(formData: FormData) {
  const file = formData.get("backupFile");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function restoreDatabaseBackup(formData: FormData) {
  const userId = await requireSuperAdminWithPassword(formData);
  const confirmationText = clean(formData.get("confirmationText"));

  if (confirmationText !== "RESTORE GLV DATABASE") {
    redirect("/settings?error=restore-confirmation-required");
  }

  const file = getBackupFile(formData);
  if (!file) {
    redirect("/settings?error=missing-backup-file");
  }

  let backup: DatabaseBackup;

  try {
    backup = JSON.parse(await file.text()) as DatabaseBackup;
  } catch {
    redirect("/settings?error=invalid-backup-file");
  }

  if (backup.kind !== "GLV_DATABASE_BACKUP" || backup.version !== 1) {
    redirect("/settings?error=invalid-backup-file");
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.loginRateLimit.deleteMany();
      await tx.staffSalaryPayment.deleteMany();
      await tx.staffSalaryHistory.deleteMany();
      await tx.customerCredit.deleteMany();
      await tx.payment.deleteMany();
      await tx.customerAccount.deleteMany();
      await tx.customer.deleteMany();
      await tx.profileChangeRequest.deleteMany();
      await tx.userAppearancePreference.deleteMany();
      await tx.user.deleteMany();
      await tx.staffInventory.deleteMany();
      await tx.staff.deleteMany();
      await tx.staffApplication.deleteMany();
      await tx.product.deleteMany();
      await tx.productCategory.deleteMany();
      await tx.setting.deleteMany();

      const tables = backup.tables;

      if (tables.settings?.length) {
        await tx.setting.createMany({
          data: reviveBackupRows<Prisma.SettingCreateManyInput>(
            "settings",
            tables.settings
          ),
        });
      }
      if (tables.productCategories?.length) {
        await tx.productCategory.createMany({
          data: reviveBackupRows<Prisma.ProductCategoryCreateManyInput>(
            "productCategories",
            tables.productCategories
          ),
        });
      }
      if (tables.products?.length) {
        await tx.product.createMany({
          data: reviveBackupRows<Prisma.ProductCreateManyInput>(
            "products",
            tables.products
          ),
        });
      }
      if (tables.staffApplications?.length) {
        await tx.staffApplication.createMany({
          data: reviveBackupRows<Prisma.StaffApplicationCreateManyInput>(
            "staffApplications",
            tables.staffApplications
          ),
        });
      }
      if (tables.staff?.length) {
        await tx.staff.createMany({
          data: reviveBackupRows<Prisma.StaffCreateManyInput>(
            "staff",
            tables.staff
          ),
        });
      }
      if (tables.users?.length) {
        await tx.user.createMany({
          data: reviveBackupRows<Prisma.UserCreateManyInput>(
            "users",
            tables.users
          ),
        });
      }
      if (tables.staffInventory?.length) {
        await tx.staffInventory.createMany({
          data: reviveBackupRows<Prisma.StaffInventoryCreateManyInput>(
            "staffInventory",
            tables.staffInventory
          ),
        });
      }
      if (tables.userAppearancePreferences?.length) {
        await tx.userAppearancePreference.createMany({
          data: reviveBackupRows<Prisma.UserAppearancePreferenceCreateManyInput>(
            "userAppearancePreferences",
            tables.userAppearancePreferences
          ),
        });
      }
      if (tables.profileChangeRequests?.length) {
        await tx.profileChangeRequest.createMany({
          data: reviveBackupRows<Prisma.ProfileChangeRequestCreateManyInput>(
            "profileChangeRequests",
            tables.profileChangeRequests
          ),
        });
      }
      if (tables.customers?.length) {
        await tx.customer.createMany({
          data: reviveBackupRows<Prisma.CustomerCreateManyInput>(
            "customers",
            tables.customers
          ),
        });
      }
      if (tables.customerAccounts?.length) {
        await tx.customerAccount.createMany({
          data: reviveBackupRows<Prisma.CustomerAccountCreateManyInput>(
            "customerAccounts",
            tables.customerAccounts
          ),
        });
      }
      if (tables.payments?.length) {
        await tx.payment.createMany({
          data: reviveBackupRows<Prisma.PaymentCreateManyInput>(
            "payments",
            tables.payments
          ),
        });
      }
      if (tables.customerCredits?.length) {
        await tx.customerCredit.createMany({
          data: reviveBackupRows<Prisma.CustomerCreditCreateManyInput>(
            "customerCredits",
            tables.customerCredits
          ),
        });
      }
      if (tables.staffSalaryHistory?.length) {
        await tx.staffSalaryHistory.createMany({
          data: reviveBackupRows<Prisma.StaffSalaryHistoryCreateManyInput>(
            "staffSalaryHistory",
            tables.staffSalaryHistory
          ),
        });
      }
      if (tables.staffSalaryPayments?.length) {
        await tx.staffSalaryPayment.createMany({
          data: reviveBackupRows<Prisma.StaffSalaryPaymentCreateManyInput>(
            "staffSalaryPayments",
            tables.staffSalaryPayments
          ),
        });
      }
      if (tables.loginRateLimits?.length) {
        await tx.loginRateLimit.createMany({
          data: reviveBackupRows<Prisma.LoginRateLimitCreateManyInput>(
            "loginRateLimits",
            tables.loginRateLimits
          ),
        });
      }
      if (tables.auditLogs?.length) {
        await tx.auditLog.createMany({
          data: reviveBackupRows<Prisma.AuditLogCreateManyInput>(
            "auditLogs",
            tables.auditLogs
          ),
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: "RESTORE_DATABASE_BACKUP",
          entity: "DatabaseBackup",
          entityId: backup.generatedAt,
          newValue: JSON.stringify({
            generatedAt: backup.generatedAt,
            tables: backupTableOrder.reduce<Record<string, number>>(
              (counts, table) => {
                counts[table] = backup.tables[table]?.length ?? 0;
                return counts;
              },
              {}
            ),
          }),
        },
      });
    },
    { timeout: 30_000 }
  );

  revalidatePath("/", "layout");
  redirect("/settings?restored=database");
}
