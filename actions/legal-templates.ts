"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";
import { ensureDefaultLegalTemplates } from "@/lib/legal-templates";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function updateLegalTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  await ensureDefaultLegalTemplates();
  const key = clean(formData.get("key"));
  const name = clean(formData.get("name"));
  const subject = clean(formData.get("subject"));
  const body = clean(formData.get("body"));
  if (!key || !name || !subject || !body) {
    redirect("/settings/legal?error=missing-fields");
  }
  await prisma.$transaction([
    prisma.legalTemplate.update({
      where: { key },
      data: {
        name,
        subject,
        body,
        active: formData.get("active") === "on",
        updatedBy: session.user.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_LEGAL_TEMPLATE",
        entity: "LegalTemplate",
        entityId: key,
        newValue: JSON.stringify({ name, subject, active: formData.get("active") === "on" }),
      },
    }),
  ]);
  revalidatePath("/settings/legal");
  redirect("/settings/legal?saved=1");
}
