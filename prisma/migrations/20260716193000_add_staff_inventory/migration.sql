-- Track product stock allocated to each staff member.
CREATE TABLE "StaffInventory" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInventory_staffId_productId_key" ON "StaffInventory"("staffId", "productId");
CREATE INDEX "StaffInventory_productId_idx" ON "StaffInventory"("productId");
CREATE INDEX "StaffInventory_quantity_idx" ON "StaffInventory"("quantity");

ALTER TABLE "StaffInventory"
ADD CONSTRAINT "StaffInventory_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInventory"
ADD CONSTRAINT "StaffInventory_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing accounts remain valid with a null inventory owner.
ALTER TABLE "CustomerAccount" ADD COLUMN "inventoryStaffId" TEXT;

ALTER TABLE "CustomerAccount"
ADD CONSTRAINT "CustomerAccount_inventoryStaffId_fkey"
FOREIGN KEY ("inventoryStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
