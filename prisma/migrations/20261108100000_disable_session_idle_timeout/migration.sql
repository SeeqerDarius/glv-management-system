ALTER TABLE "Setting"
  ALTER COLUMN "sessionTimeoutMinutes" SET DEFAULT 0;

UPDATE "Setting"
SET "sessionTimeoutMinutes" = 0
WHERE "sessionTimeoutMinutes" > 0;
