ALTER TABLE "Setting" ALTER COLUMN "procurementThresholdPercent" SET DEFAULT 85;

UPDATE "Setting"
SET "procurementThresholdPercent" = 85
WHERE "procurementThresholdPercent" = 50;
