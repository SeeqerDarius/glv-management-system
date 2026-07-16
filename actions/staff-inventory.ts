"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

function cleanInput(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requireAdminUser() {
  const session = await auth();

  if (!session?.user?.id || !isAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    role: session.user.role,
  };
}

export async function updateStaffInventory(formData: FormData): Promise<void> {
  const user = await requireAdminUser();
  const staffId = cleanInput(formData.get("staffId"));
  const productId = cleanInput(formData.get("productId"));
  const quantityValue = cleanInput(formData.get("quantity"));
  const returnTo = cleanInput(formData.get("returnTo")) || `/staff/${staffId}`;
  const quantityChange = Number(quantityValue);

  if (
    !staffId ||
    !productId ||
    !Number.isInteger(quantityChange) ||
    quantityChange === 0
  ) {
    redirect(`${returnTo}?inventory=invalid`);
  }

  const [staff, product] = await Promise.all([
    prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, fullName: true },
    }),
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    }),
  ]);

  if (!staff || !product) {
    redirect(`${returnTo}?inventory=not-found`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.staffInventory.findUnique({
        where: {
          staffId_productId: {
            staffId,
            productId,
          },
        },
      });
      const currentQuantity = existing?.quantity ?? 0;
      const nextQuantity = currentQuantity + quantityChange;

      if (nextQuantity < 0) {
        throw new Error("inventory-negative");
      }

      const inventory = await tx.staffInventory.upsert({
        where: {
          staffId_productId: {
            staffId,
            productId,
          },
        },
        update: {
          quantity: nextQuantity,
        },
        create: {
          staffId,
          productId,
          quantity: nextQuantity,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: quantityChange > 0 ? "RESTOCK_STAFF_INVENTORY" : "ADJUST_STAFF_INVENTORY",
          entity: "StaffInventory",
          entityId: inventory.id,
          oldValue: JSON.stringify({
            staffId,
            productId,
            quantity: currentQuantity,
          }),
          newValue: JSON.stringify({
            staffId,
            productId,
            quantity: nextQuantity,
            quantityChange,
            staffName: staff.fullName,
            productName: product.name,
          }),
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "inventory-negative") {
      redirect(`${returnTo}?inventory=negative`);
    }

    console.error("UPDATE_STAFF_INVENTORY_ERROR", error);
    redirect(`${returnTo}?inventory=error`);
  }

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/accounts/new");
  revalidatePath("/customers/new");
  revalidatePath("/products");
  redirect(`${returnTo}?inventory=updated`);
}
