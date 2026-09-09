CREATE TABLE "SmsNotification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SmsNotification_dedupeKey_key" ON "SmsNotification"("dedupeKey");
CREATE INDEX "SmsNotification_status_scheduledAt_idx" ON "SmsNotification"("status", "scheduledAt");
CREATE INDEX "SmsNotification_sourceId_idx" ON "SmsNotification"("sourceId");
