import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function verifyAdminDeleteConfirmation({
  formData,
  adminUserId,
  redirectPath,
  requiresStrongConfirmation = true,
}: {
  formData: FormData;
  adminUserId: string;
  redirectPath: string;
  requiresStrongConfirmation?: boolean;
}) {
  const confirmationText = cleanInput(formData.get("confirmationText"));

  if (!requiresStrongConfirmation) {
    if (confirmationText !== "CONFIRM") {
      redirect(`${redirectPath}?error=delete-confirmation-required`);
    }

    return;
  }

  const adminPassword = cleanInput(formData.get("adminPassword"));

  if (confirmationText !== "DELETE") {
    redirect(`${redirectPath}?error=delete-confirmation-required`);
  }

  if (!adminPassword) {
    redirect(`${redirectPath}?error=admin-password-required`);
  }

  const adminUser = await prisma.user.findUnique({
    where: {
      id: adminUserId,
    },
    select: {
      password: true,
    },
  });

  const passwordValid = adminUser
    ? await bcrypt.compare(adminPassword, adminUser.password)
    : false;

  if (!passwordValid) {
    redirect(`${redirectPath}?error=invalid-admin-password`);
  }
}
