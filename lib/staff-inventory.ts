import type { Prisma } from "@prisma/client";

export class StaffInventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffInventoryError";
  }
}

export async function consumeStaffInventory({
  tx,
  userId,
  staffId,
  productId,
  accountId,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  staffId: string;
  productId: string;
  accountId: string;
}) {
  const result = await tx.staffInventory.updateMany({
    where: {
      staffId,
      productId,
      quantity: {
        gt: 0,
      },
    },
    data: {
      quantity: {
        decrement: 1,
      },
    },
  });

  if (result.count !== 1) {
    throw new StaffInventoryError(
      "This staff member has no stock left for the selected product.",
    );
  }

  await tx.auditLog.create({
    data: {
      userId,
      action: "CONSUME_STAFF_INVENTORY",
      entity: "StaffInventory",
      entityId: `${staffId}:${productId}`,
      newValue: JSON.stringify({
        staffId,
        productId,
        accountId,
        quantityChange: -1,
      }),
    },
  });
}

export async function restoreStaffInventory({
  tx,
  userId,
  staffId,
  productId,
  accountId,
}: {
  tx: Prisma.TransactionClient;
  userId: string;
  staffId: string;
  productId: string;
  accountId: string;
}) {
  const inventory = await tx.staffInventory.upsert({
    where: {
      staffId_productId: {
        staffId,
        productId,
      },
    },
    update: {
      quantity: {
        increment: 1,
      },
    },
    create: {
      staffId,
      productId,
      quantity: 1,
    },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: "RESTORE_STAFF_INVENTORY",
      entity: "StaffInventory",
      entityId: inventory.id,
      newValue: JSON.stringify({
        staffId,
        productId,
        accountId,
        quantityChange: 1,
      }),
    },
  });
}
