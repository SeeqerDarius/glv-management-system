"use server";

import { UserPermission } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProcurementAccounts } from "@/lib/procurement";
import { hasPermission } from "@/lib/roles";

async function requireProcurementManager() {
  const session = await auth();

  if (
    !session?.user?.id ||
    !session.user.role ||
    !hasPermission(
      session.user.role,
      session.user.permissions,
      UserPermission.MANAGE_PRODUCTS
    )
  ) {
    throw new Error("Unauthorized");
  }

  return { id: session.user.id };
}

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeReturnTo(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function revalidateProcurement(productId: string) {
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/procurement/${productId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

/**
 * Confirms that units of a product were actually bought. Each confirmed unit is
 * attached to the customer account closest to completion, so the buying list
 * shrinks by exactly the quantity entered.
 */
export async function confirmProcurement(formData: FormData): Promise<void> {
  const user = await requireProcurementManager();

  const productId = cleanInput(formData.get("productId"));
  const accountId = cleanInput(formData.get("accountId"));
  const quantityValue = cleanInput(formData.get("quantity"));
  const returnTo = safeReturnTo(
    cleanInput(formData.get("returnTo")),
    productId ? `/products/procurement/${productId}` : "/products?tab=procurement"
  );

  if (!productId) {
    redirect("/products?tab=procurement&error=procurement-product-required");
  }

  // A single-unit confirmation names its account; a bulk confirmation gives a
  // quantity and the queue decides which units are covered.
  const quantity = accountId ? 1 : Number(quantityValue);

  if (!accountId && (!Number.isInteger(quantity) || quantity < 1)) {
    redirect(`${returnTo}?error=procurement-invalid-quantity`);
  }

  const procurement = await getProcurementAccounts(productId);

  if (!procurement.items.length) {
    redirect(`${returnTo}?error=procurement-nothing-pending`);
  }

  const queue = accountId
    ? procurement.items.filter((item) => item.accountId === accountId)
    : // Buy first for the customers who are closest to finishing their plan.
      [...procurement.items].sort((a, b) => b.progress - a.progress);

  if (!queue.length) {
    redirect(`${returnTo}?error=procurement-nothing-pending`);
  }

  const selected = queue.slice(0, quantity);
  const procuredAt = new Date();

  const confirmed = await prisma.$transaction(async (tx) => {
    // The guard on `procuredAt` keeps two operators confirming at once from
    // consuming the same unit twice.
    const result = await tx.customerAccount.updateMany({
      where: {
        id: { in: selected.map((item) => item.accountId) },
        productId,
        procuredAt: null,
      },
      data: {
        procuredAt,
        procuredBy: user.id,
      },
    });

    if (result.count) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CONFIRM_PROCUREMENT",
          entity: "Product",
          entityId: productId,
          newValue: JSON.stringify({
            procuredAt: procuredAt.toISOString(),
            requestedQuantity: quantity,
            confirmedQuantity: result.count,
            accountIds: selected.map((item) => item.accountId),
          }),
        },
      });
    }

    return result.count;
  });

  if (!confirmed) {
    redirect(`${returnTo}?error=procurement-nothing-pending`);
  }

  revalidateProcurement(productId);
  redirect(`${returnTo}?procured=${confirmed}`);
}

/** Reverses a procurement confirmation that was entered by mistake. */
export async function undoProcurement(formData: FormData): Promise<void> {
  const user = await requireProcurementManager();

  const accountId = cleanInput(formData.get("accountId"));
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, productId: true, procuredAt: true, procuredBy: true },
  });

  const returnTo = safeReturnTo(
    cleanInput(formData.get("returnTo")),
    account ? `/products/procurement/${account.productId}` : "/products?tab=procurement"
  );

  if (!account || !account.procuredAt) {
    redirect(`${returnTo}?error=procurement-not-confirmed`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerAccount.update({
      where: { id: account.id },
      data: { procuredAt: null, procuredBy: null },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UNDO_CONFIRM_PROCUREMENT",
        entity: "CustomerAccount",
        entityId: account.id,
        oldValue: JSON.stringify({
          procuredAt: account.procuredAt,
          procuredBy: account.procuredBy,
        }),
        newValue: JSON.stringify({ procuredAt: null, procuredBy: null }),
      },
    });
  });

  revalidateProcurement(account.productId);
  redirect(`${returnTo}?procurement=reopened`);
}
