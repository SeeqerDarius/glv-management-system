"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { reverseAction } from "@/lib/undo";

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeReturnTo(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * Retracts a reversible action. Administrator-only, like every action that can
 * be retracted through it.
 */
export async function undoAction(formData: FormData): Promise<void> {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const id = cleanInput(formData.get("id"));
  const returnTo = safeReturnTo(cleanInput(formData.get("returnTo")), "/activity");

  const result = await reverseAction(id, session.user.id);

  const separator = returnTo.includes("?") ? "&" : "?";

  if (!result.ok) {
    redirect(`${returnTo}${separator}undoError=${result.refusal}`);
  }

  // A retraction can move money, account status and staff figures at once, so
  // everything that reads them is refreshed rather than guessing the subset.
  revalidatePath("/activity");
  revalidatePath("/accounts");
  revalidatePath("/payments");
  revalidatePath("/credits");
  revalidatePath("/reports");
  revalidatePath("/dashboard");

  if (result.entity === "CustomerAccount") {
    revalidatePath(`/accounts/${result.entityId}`);
  }

  redirect(`${returnTo}${separator}undone=${result.action}`);
}
