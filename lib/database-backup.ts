import { prisma } from "@/lib/prisma";
import { ensureSettingsSchema } from "@/lib/settings-schema";

export const backupTableOrder = [
  "settings",
  "productCategories",
  "products",
  "staffApplications",
  "staff",
  "users",
  "userAppearancePreferences",
  "profileChangeRequests",
  "customers",
  "customerAccounts",
  "payments",
  "customerCredits",
  "staffSalaryHistory",
  "staffSalaryPayments",
  "auditLogs",
  "loginRateLimits",
] as const;

export type DatabaseBackup = {
  kind: "GLV_DATABASE_BACKUP";
  version: 1;
  generatedAt: string;
  tables: Record<(typeof backupTableOrder)[number], unknown[]>;
};

const dateFields: Record<string, string[]> = {
  settings: ["createdAt", "lastBackupAt"],
  productCategories: ["createdAt", "updatedAt"],
  staffApplications: ["reviewedAt", "createdAt"],
  staff: ["createdAt"],
  users: ["createdAt", "lastSeenAt", "twoFactorConfirmedAt"],
  userAppearancePreferences: ["createdAt", "updatedAt"],
  profileChangeRequests: ["reviewedAt", "createdAt", "updatedAt"],
  customers: ["createdAt"],
  customerAccounts: ["startDate", "expectedEndDate", "deliveredAt", "createdAt"],
  payments: ["paymentDate", "createdAt"],
  customerCredits: ["resolvedAt", "createdAt"],
  staffSalaryHistory: ["effectiveMonth", "createdAt"],
  staffSalaryPayments: ["paymentDate", "salaryMonth", "createdAt"],
  auditLogs: ["createdAt"],
  loginRateLimits: ["lockedUntil", "lastAttemptAt", "createdAt", "updatedAt"],
};

export async function buildDatabaseBackup(): Promise<DatabaseBackup> {
  await ensureSettingsSchema();

  const [
    settings,
    productCategories,
    products,
    staffApplications,
    staff,
    users,
    userAppearancePreferences,
    profileChangeRequests,
    customers,
    customerAccounts,
    payments,
    customerCredits,
    staffSalaryHistory,
    staffSalaryPayments,
    auditLogs,
    loginRateLimits,
  ] = await Promise.all([
    prisma.setting.findMany(),
    prisma.productCategory.findMany(),
    prisma.product.findMany(),
    prisma.staffApplication.findMany(),
    prisma.staff.findMany(),
    prisma.user.findMany(),
    prisma.userAppearancePreference.findMany(),
    prisma.profileChangeRequest.findMany(),
    prisma.customer.findMany(),
    prisma.customerAccount.findMany(),
    prisma.payment.findMany(),
    prisma.customerCredit.findMany(),
    prisma.staffSalaryHistory.findMany(),
    prisma.staffSalaryPayment.findMany(),
    prisma.auditLog.findMany(),
    prisma.loginRateLimit.findMany(),
  ]);

  return {
    kind: "GLV_DATABASE_BACKUP",
    version: 1,
    generatedAt: new Date().toISOString(),
    tables: {
      settings,
      productCategories,
      products,
      staffApplications,
      staff,
      users,
      userAppearancePreferences,
      profileChangeRequests,
      customers,
      customerAccounts,
      payments,
      customerCredits,
      staffSalaryHistory,
      staffSalaryPayments,
      auditLogs,
      loginRateLimits,
    },
  };
}

export function reviveBackupRows<T>(table: string, rows: unknown): T[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    if (!row || typeof row !== "object") return row as T;
    const revived = { ...(row as Record<string, unknown>) };

    if (table === "settings") {
      delete revived.defaultStaffInventoryQuantity;
    }
    if (table === "customerAccounts") {
      delete revived.inventoryStaffId;
    }

    for (const field of dateFields[table] ?? []) {
      const value = revived[field];
      if (typeof value === "string") {
        revived[field] = new Date(value);
      }
    }

    return revived as T;
  });
}
