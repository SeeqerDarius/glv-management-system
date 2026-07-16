"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { generateTotpSecret, verifyTotpCode } from "@/lib/totp";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requireAdminUser() {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
  };
}

export async function generateTwoFactorSecret() {
  const user = await requireAdminUser();
  const secret = generateTotpSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: false,
      twoFactorConfirmedAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "GENERATE_2FA_SECRET",
      entity: "User",
      entityId: user.id,
      newValue: JSON.stringify({ twoFactorSetupStarted: true }),
    },
  });

  revalidatePath("/security/2fa");
  redirect("/security/2fa");
}

export async function enableTwoFactor(formData: FormData) {
  const sessionUser = await requireAdminUser();
  const code = clean(formData.get("code"));

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      twoFactorSecret: true,
    },
  });

  if (!user?.twoFactorSecret) {
    redirect("/security/2fa?error=missing-secret");
  }

  if (!verifyTotpCode(user.twoFactorSecret, code)) {
    redirect("/security/2fa?error=invalid-code");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorConfirmedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "ENABLE_2FA",
        entity: "User",
        entityId: user.id,
        newValue: JSON.stringify({ twoFactorEnabled: true }),
      },
    });
  });

  revalidatePath("/security/2fa");
  revalidatePath("/", "layout");
  redirect("/dashboard?security=2fa-enabled");
}
