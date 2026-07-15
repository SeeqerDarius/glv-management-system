import { UserRole, type User } from "@prisma/client";

export const ownerEmail = "admin@glv.com";

export function isOwnerEmail(email?: string | null) {
  return email?.trim().toLowerCase() === ownerEmail;
}

export function normalizeOwnerRole(
  email: string | null | undefined,
  role: User["role"]
) {
  return isOwnerEmail(email) ? UserRole.SUPER_ADMIN : role;
}
