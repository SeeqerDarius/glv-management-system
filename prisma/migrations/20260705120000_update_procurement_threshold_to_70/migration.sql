ALTER TABLE "Setting" ALTER COLUMN "procurementThresholdPercent" SET DEFAULT 70;

UPDATE "Setting"
SET "procurementThresholdPercent" = 70
WHERE "procurementThresholdPercent" = 85;
