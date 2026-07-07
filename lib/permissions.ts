import { UserPermission } from "@prisma/client";

export const assistantAdminPermissions = [
  UserPermission.MANAGE_CUSTOMERS,
  UserPermission.MANAGE_ACCOUNTS,
  UserPermission.MANAGE_PAYMENTS,
  UserPermission.VIEW_REPORTS,
  UserPermission.MANAGE_PRODUCTS,
  UserPermission.MANAGE_STAFF,
  UserPermission.VIEW_AUDIT_LOGS,
] as const;

export const permissionLabels: Record<UserPermission, string> = {
  [UserPermission.MANAGE_CUSTOMERS]: "Manage Customers",
  [UserPermission.MANAGE_ACCOUNTS]: "Manage Accounts",
  [UserPermission.MANAGE_PAYMENTS]: "Manage Payments",
  [UserPermission.VIEW_REPORTS]: "View Reports",
  [UserPermission.MANAGE_PRODUCTS]: "Manage Products & Procurement",
  [UserPermission.MANAGE_STAFF]: "Manage Staff",
  [UserPermission.VIEW_AUDIT_LOGS]: "View Audit Logs",
};

export function parsePermissions(values: FormDataEntryValue[]) {
  const allowed = new Set<string>(assistantAdminPermissions);

  return values
    .map(String)
    .filter((value): value is UserPermission => allowed.has(value));
}
