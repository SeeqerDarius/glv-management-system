import { UserRole, type User } from "@prisma/client";

export const ownerEmails = ["admin@glv.com", "rockfrostconsult@gmail.com"];

export function isOwnerEmail(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(
    normalizedEmail && ownerEmails.includes(normalizedEmail)
  );
}

export function normalizeOwnerRole(
  email: string | null | undefined,
  role: User["role"]
) {
  return isOwnerEmail(email) ? UserRole.SUPER_ADMIN : role;
}
