import { prisma } from "@/lib/prisma";

const globalStaffInventorySchema = globalThis as unknown as {
  glvStaffInventorySchemaReady?: boolean;
};

export async function ensureStaffInventorySchema() {
  if (globalStaffInventorySchema.glvStaffInventorySchemaReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StaffInventory" (
      "id" TEXT NOT NULL,
      "staffId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StaffInventory_pkey" PRIMARY KEY ("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "CustomerAccount"
    ADD COLUMN IF NOT EXISTS "inventoryStaffId" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StaffInventory_staffId_productId_key"
    ON "StaffInventory"("staffId", "productId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StaffInventory_productId_idx"
    ON "StaffInventory"("productId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StaffInventory_quantity_idx"
    ON "StaffInventory"("quantity")
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StaffInventory_staffId_fkey'
      ) THEN
        ALTER TABLE "StaffInventory"
        ADD CONSTRAINT "StaffInventory_staffId_fkey"
        FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StaffInventory_productId_fkey'
      ) THEN
        ALTER TABLE "StaffInventory"
        ADD CONSTRAINT "StaffInventory_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CustomerAccount_inventoryStaffId_fkey'
      ) THEN
        ALTER TABLE "CustomerAccount"
        ADD CONSTRAINT "CustomerAccount_inventoryStaffId_fkey"
        FOREIGN KEY ("inventoryStaffId") REFERENCES "Staff"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  globalStaffInventorySchema.glvStaffInventorySchemaReady = true;
}

export async function ensureStaffInventorySchemaForRead(context: string) {
  try {
    await ensureStaffInventorySchema();
    return true;
  } catch (error) {
    console.error(`${context}_STAFF_INVENTORY_SCHEMA_ERROR`, error);
    return false;
  }
}
