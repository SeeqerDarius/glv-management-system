"use server";

import { UserPermission } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INVENTORY_REASONS, recordInventoryMovement } from "@/lib/inventory";
import { hasPermission } from "@/lib/roles";

async function requireStockKeeper() {
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
 * Books bought units into the store room. This is the action that answers the
 * procurement list: once the stock is in, the product stops asking to be
 * bought.
 */
export async function receiveStock(formData: FormData): Promise<void> {
  const user = await requireStockKeeper();

  const productId = cleanInput(formData.get("productId"));
  const quantity = Number(cleanInput(formData.get("quantity")));
  const note = cleanInput(formData.get("note"));
  const returnTo = safeReturnTo(
    cleanInput(formData.get("returnTo")),
    "/inventory"
  );

  if (!productId) {
    redirect("/inventory?error=inventory-product-required");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    redirect(`${returnTo}?error=inventory-invalid-quantity`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });

  if (!product) {
    redirect(`${returnTo}?error=inventory-product-not-found`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const movement = await recordInventoryMovement(tx, {
      productId,
      delta: quantity,
      reason: INVENTORY_REASONS.RECEIVED,
      createdBy: user.id,
      note,
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "RECEIVE_STOCK",
        entity: "Product",
        entityId: productId,
        oldValue: JSON.stringify({ stockOnHand: movement.balanceBefore }),
        newValue: JSON.stringify({
          stockOnHand: movement.balanceAfter,
          received: quantity,
          note: note || null,
        }),
      },
    });

    return movement;
  });

  revalidateStockViews(productId);
  redirect(`${returnTo}?received=${quantity}&balance=${result.balanceAfter}`);
}

/**
 * Sets stock on hand to what was actually counted on the shelf. Corrections are
 * recorded as the difference rather than a silent overwrite, so a count that
 * keeps drifting is visible in the ledger.
 */
export async function correctStock(formData: FormData): Promise<void> {
  const user = await requireStockKeeper();

  const productId = cleanInput(formData.get("productId"));
  const countedValue = cleanInput(formData.get("counted"));
  const counted = Number(countedValue);
  const note = cleanInput(formData.get("note"));
  const returnTo = safeReturnTo(
    cleanInput(formData.get("returnTo")),
    "/inventory"
  );

  if (!productId) {
    redirect("/inventory?error=inventory-product-required");
  }

  if (!countedValue || !Number.isInteger(counted) || counted < 0 || counted > 100000) {
    redirect(`${returnTo}?error=inventory-invalid-count`);
  }

  // A correction that cannot be explained is how a count quietly goes wrong, so
  // the reason is required.
  if (!note) {
    redirect(`${returnTo}?error=inventory-reason-required`);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stockOnHand: true },
  });

  if (!product) {
    redirect(`${returnTo}?error=inventory-product-not-found`);
  }

  if (product.stockOnHand === counted) {
    redirect(`${returnTo}?error=inventory-no-change`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const movement = await recordInventoryMovement(tx, {
      productId,
      delta: counted - product.stockOnHand,
      reason: INVENTORY_REASONS.CORRECTION,
      createdBy: user.id,
      note,
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CORRECT_STOCK",
        entity: "Product",
        entityId: productId,
        oldValue: JSON.stringify({ stockOnHand: movement.balanceBefore }),
        newValue: JSON.stringify({
          stockOnHand: movement.balanceAfter,
          note,
        }),
      },
    });

    return movement;
  });

  revalidateStockViews(productId);
  redirect(`${returnTo}?corrected=${result.balanceAfter}`);
}

function revalidateStockViews(productId: string) {
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard");
}
