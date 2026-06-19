import { UserPermission, UserRole } from "@prisma/client";

export function isAdminRole(role?: UserRole | null) {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isSuperAdminRole(role?: UserRole | null) {
  return role === UserRole.SUPER_ADMIN;
}

export function hasPermission(
  role: UserRole | null | undefined,
  permissions: UserPermission[] | null | undefined,
  permission: UserPermission
) {
  return isAdminRole(role) || Boolean(permissions?.includes(permission));
}
