-- Create ReceiptCounter table for atomic receipt number generation
-- This fixes the race condition where concurrent payments could generate duplicate receipt numbers

CREATE TABLE "ReceiptCounter" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- Receipt numbering is an internal server-side concern, not a Data API table.
ALTER TABLE "ReceiptCounter" ENABLE ROW LEVEL SECURITY;

-- Create unique constraint on prefix + year combination
CREATE UNIQUE INDEX "ReceiptCounter_prefix_year_key" ON "ReceiptCounter"("prefix", "year");

-- Create index for efficient lookups
CREATE INDEX "ReceiptCounter_prefix_year_idx" ON "ReceiptCounter"("prefix", "year");

-- Seed existing receipt counters from current payment data
-- Extract the current year and prefix from existing payments to initialize counters
INSERT INTO "ReceiptCounter" ("id", "prefix", "year", "nextValue", "updatedAt")
SELECT
    gen_random_uuid() as id,
    SUBSTRING("receiptNo", 1, STRPOS("receiptNo", '/') - 1) as prefix,
    SUBSTRING("receiptNo", STRPOS("receiptNo", '/') + 1, 2) as year,
    COALESCE(MAX(CAST(SUBSTRING("receiptNo", STRPOS("receiptNo", '/') + 4) AS INTEGER)) + 1, 1) as nextValue,
    NOW() as "updatedAt"
FROM "Payment"
WHERE "receiptNo" ~ '^[A-Z]+/[0-9]{2}/[0-9]{6}$'
GROUP BY SUBSTRING("receiptNo", 1, STRPOS("receiptNo", '/') - 1),
         SUBSTRING("receiptNo", STRPOS("receiptNo", '/') + 1, 2)
ON CONFLICT ("prefix", "year") DO NOTHING;
