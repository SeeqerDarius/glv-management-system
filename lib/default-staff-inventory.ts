import type { Prisma } from "@prisma/client";
import { ensureStaffInventorySchema } from "@/lib/staff-inventory-schema";

export function normalizeDefaultStaffInventoryQuantity(value: unknown) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 0 ? quantity : 10;
}

export async function assignDefaultInventoryToStaff({
  tx,
  staffId,
  quantity,
}: {
  tx: Prisma.TransactionClient;
  staffId: string;
  quantity: number;
}) {
  await ensureStaffInventorySchema();

  const products = await tx.product.findMany({
    where: { active: true },
    select: { id: true },
  });

  if (products.length === 0) {
    return 0;
  }

  const result = await tx.staffInventory.createMany({
    data: products.map((product) => ({
      staffId,
      productId: product.id,
      quantity,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function assignDefaultInventoryForProduct({
  tx,
  productId,
  quantity,
}: {
  tx: Prisma.TransactionClient;
  productId: string;
  quantity: number;
}) {
  await ensureStaffInventorySchema();

  const staff = await tx.staff.findMany({
    where: { active: true },
    select: { id: true },
  });

  if (staff.length === 0) {
    return 0;
  }

  const result = await tx.staffInventory.createMany({
    data: staff.map((member) => ({
      staffId: member.id,
      productId,
      quantity,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function syncDefaultInventoryForAllStaff({
  tx,
  quantity,
}: {
  tx: Prisma.TransactionClient;
  quantity: number;
}) {
  await ensureStaffInventorySchema();

  const [staff, products] = await Promise.all([
    tx.staff.findMany({
      where: { active: true },
      select: { id: true },
    }),
    tx.product.findMany({
      where: { active: true },
      select: { id: true },
    }),
  ]);

  if (staff.length === 0 || products.length === 0) {
    return 0;
  }

  const result = await tx.staffInventory.createMany({
    data: staff.flatMap((member) =>
      products.map((product) => ({
        staffId: member.id,
        productId: product.id,
        quantity,
      }))
    ),
    skipDuplicates: true,
  });

  return result.count;
}
