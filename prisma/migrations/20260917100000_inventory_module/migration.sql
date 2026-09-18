-- Inventory module.
--
-- Stock on hand becomes the thing that decides whether a product needs buying:
-- a product only appears on the procurement list when the units its customers
-- are owed exceed the units already sitting in the store room. That replaces
-- the per-account "confirm procured" flag, which could not answer "how many do
-- we actually have?".

-- 1. Stock on hand per product.
ALTER TABLE "Product" ADD COLUMN "stockOnHand" INTEGER NOT NULL DEFAULT 0;

-- 2. The ledger behind that number, so any count can be explained.
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "accountId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Carry the old flag forward as opening stock. Units marked procured but not
--    yet delivered were really bought, so they are on the shelf today. Without
--    this they would reappear on the procurement list and be bought twice.
WITH "opening" AS (
    SELECT "productId", COUNT(*)::int AS "units"
    FROM "CustomerAccount"
    WHERE "procuredAt" IS NOT NULL
      AND "deliveryStatus" = 'PENDING'
    GROUP BY "productId"
)
UPDATE "Product"
SET "stockOnHand" = "opening"."units"
FROM "opening"
WHERE "Product"."id" = "opening"."productId";

INSERT INTO "InventoryMovement" ("id", "productId", "delta", "reason", "balanceAfter", "note", "createdBy", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    "id",
    "stockOnHand",
    'OPENING',
    "stockOnHand",
    'Opening stock carried over from units already confirmed as procured.',
    'system',
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "stockOnHand" > 0;

-- 4. Retire the per-account procurement flag, now that stock answers the
--    question it was asked to answer.
DROP INDEX IF EXISTS "CustomerAccount_procuredAt_idx";
ALTER TABLE "CustomerAccount" DROP COLUMN "procuredAt";
ALTER TABLE "CustomerAccount" DROP COLUMN "procuredBy";

-- 5. Retire the hand-typed catalogue field that stock on hand supersedes. It is
--    zero on every product in production, so nothing is lost.
ALTER TABLE "Product" DROP COLUMN "quantityOnSale";
