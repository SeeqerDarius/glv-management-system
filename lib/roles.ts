import { UserRole } from "@prisma/client";

export function isAdminRole(role?: UserRole | null) {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isSuperAdminRole(role?: UserRole | null) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}
