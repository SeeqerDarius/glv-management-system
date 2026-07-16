"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminRole } from "@/lib/roles";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isSuperAdminRole(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return { id: session.user.id };
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function revalidateProductCategoryPaths() {
  revalidatePath("/settings");
  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/accounts/new");
  revalidatePath("/customers/new");
}

export async function createProductCategory(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const name = clean(formData.get("name"));

  if (!name) {
    redirect("/settings?error=missing-category");
  }

  const existing = await prisma.productCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    await prisma.productCategory.update({
      where: { id: existing.id },
      data: { name, active: true },
    });
    revalidateProductCategoryPaths();
    redirect("/settings?category=restored");
  }

  const maxSort = await prisma.productCategory.aggregate({
    _max: { sortOrder: true },
  });
  const category = await prisma.productCategory.create({
    data: {
      name,
      sortOrder: Math.max(0, maxSort._max.sortOrder ?? 0) + 10,
      active: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE_PRODUCT_CATEGORY",
      entity: "ProductCategory",
      entityId: category.id,
      newValue: JSON.stringify(category),
    },
  });

  revalidateProductCategoryPaths();
  redirect("/settings?category=created");
}

export async function updateProductCategory(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));

  if (!id || !name) {
    redirect("/settings?error=missing-category");
  }

  const existing = await prisma.productCategory.findUnique({ where: { id } });
  if (!existing) {
    redirect("/settings?error=category-not-found");
  }

  const duplicate = await prisma.productCategory.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      NOT: { id },
    },
  });

  if (duplicate) {
    redirect("/settings?error=duplicate-category");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.productCategory.update({
      where: { id },
      data: { name, active: true },
    });

    if (existing.name !== updated.name) {
      await tx.product.updateMany({
        where: { category: existing.name },
        data: { category: updated.name },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_PRODUCT_CATEGORY",
        entity: "ProductCategory",
        entityId: updated.id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
      },
    });
  });

  revalidateProductCategoryPaths();
  redirect("/settings?category=updated");
}

export async function deleteProductCategory(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const id = clean(formData.get("id"));

  const existing = await prisma.productCategory.findUnique({ where: { id } });
  if (!existing) {
    redirect("/settings?error=category-not-found");
  }

  if (existing.name === "Other") {
    redirect("/settings?error=delete-other-category");
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategory.upsert({
      where: { name: "Other" },
      update: { active: true },
      create: { name: "Other", sortOrder: 999, active: true },
    });

    const affectedProducts = await tx.product.updateMany({
      where: { category: existing.name },
      data: { category: "Other" },
    });

    await tx.productCategory.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE_PRODUCT_CATEGORY",
        entity: "ProductCategory",
        entityId: existing.id,
        oldValue: JSON.stringify({
          ...existing,
          reassignedProducts: affectedProducts.count,
          reassignedTo: "Other",
        }),
      },
    });
  });

  revalidateProductCategoryPaths();
  redirect("/settings?category=deleted");
}
