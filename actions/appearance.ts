"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import {
  normalizeAppearanceSettings,
  type AppearanceSettings,
} from "@/lib/settings";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function appearanceFromForm(formData: FormData): AppearanceSettings {
  return normalizeAppearanceSettings({
    theme: text(formData, "theme"),
    primaryColor: text(formData, "primaryColor"),
    secondaryColor: text(formData, "secondaryColor"),
    dashboardCards: text(formData, "dashboardCards"),
    loadingAnimation: text(formData, "loadingAnimation"),
  });
}

function revalidateAppearancePaths() {
  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function updateMyAppearance(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const data = appearanceFromForm(formData);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userAppearancePreference.findUnique({
      where: { userId },
    });

    const preference = await tx.userAppearancePreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE_MY_APPEARANCE",
        entity: "UserAppearancePreference",
        entityId: preference.id,
        oldValue: existing ? JSON.stringify(existing) : null,
        newValue: JSON.stringify(data),
      },
    });
  });

  revalidateAppearancePaths();
  redirect("/settings?appearance=personal");
}

export async function updateGlobalAppearance(formData: FormData): Promise<void> {
  const session = await auth();
  if (
    !session?.user?.id ||
    !isSuperAdminRole(session.user.role)
  ) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;
  const data = appearanceFromForm(formData);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findFirst({ orderBy: { createdAt: "asc" } });
    const setting = existing
      ? await tx.setting.update({
          where: { id: existing.id },
          data,
        })
      : await tx.setting.create({
          data: {
            companyName: "God's Love Ventures",
            phone: "",
            ...data,
          },
        });

    await tx.auditLog.create({
      data: {
        userId,
        action: "UPDATE_GLOBAL_APPEARANCE",
        entity: "Setting",
        entityId: setting.id,
        oldValue: existing
          ? JSON.stringify({
              theme: existing.theme,
              primaryColor: existing.primaryColor,
              secondaryColor: existing.secondaryColor,
              dashboardCards: existing.dashboardCards,
              loadingAnimation: existing.loadingAnimation,
            })
          : null,
        newValue: JSON.stringify(data),
      },
    });
  });

  revalidateAppearancePaths();
  redirect("/settings?appearance=global");
}
