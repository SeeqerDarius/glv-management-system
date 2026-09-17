-- Confirmed procurement removes a unit from the procurement list without
-- touching its delivery state. Existing accounts stay unprocured.
ALTER TABLE "CustomerAccount" ADD COLUMN "procuredAt" TIMESTAMP(3);
ALTER TABLE "CustomerAccount" ADD COLUMN "procuredBy" TEXT;

CREATE INDEX "CustomerAccount_procuredAt_idx" ON "CustomerAccount"("procuredAt");
