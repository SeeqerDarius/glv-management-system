-- Seed receipt counters for all existing numbers, including configurable
-- prefixes that contain multiple path segments (for example GLV/RCPT).
INSERT INTO "ReceiptCounter" ("id", "prefix", "year", "nextValue", "updatedAt")
SELECT
    gen_random_uuid()::text,
    SUBSTRING(p."receiptNo" FROM '^(.*)/[0-9]{2}/[0-9]{6}$'),
    SUBSTRING(p."receiptNo" FROM '^.*/([0-9]{2})/[0-9]{6}$'),
    MAX(SUBSTRING(p."receiptNo" FROM '^.*/[0-9]{2}/([0-9]{6})$')::INTEGER),
    NOW()
FROM "Payment" p
WHERE p."receiptNo" ~ '^.+/[0-9]{2}/[0-9]{6}$'
GROUP BY
    SUBSTRING(p."receiptNo" FROM '^(.*)/[0-9]{2}/[0-9]{6}$'),
    SUBSTRING(p."receiptNo" FROM '^.*/([0-9]{2})/[0-9]{6}$')
ON CONFLICT ("prefix", "year") DO UPDATE
SET "nextValue" = GREATEST("ReceiptCounter"."nextValue", EXCLUDED."nextValue"),
    "updatedAt" = NOW();
