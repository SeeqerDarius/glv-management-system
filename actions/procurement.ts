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

/**
 * Confirms that units of a product were actually bought. Each confirmed unit is
 * attached to the customer account closest to completion, so the buying list
 * shrinks by exactly the quantity entered.
 */
export async function confirmProcurement(formData: FormData): Promise<void> {
  const user = await requireProcurementManager();

  const productId = cleanInput(formData.get("productId"));
  const quantityValue = cleanInput(formData.get("quantity"));
  const returnTo = safeReturnTo(
    cleanInput(formData.get("returnTo")),
    productId ? `/products/procurement/${productId}` : "/products?tab=procurement"
  );

  if (!productId) {
    redirect("/products?tab=procurement&error=procurement-product-required");
  }

  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity < 1) {
    redirect(`${returnTo}?error=procurement-invalid-quantity`);
  }

  const procurement = await getProcurementAccounts(productId);

  if (!procurement.items.length) {
    redirect(`${returnTo}?error=procurement-nothing-pending`);
  }

  // Cover the customers closest to finishing their plan first.
  const selected = [...procurement.items]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, quantity);
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

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/procurement/${productId}`);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?procured=${confirmed}`);
}
