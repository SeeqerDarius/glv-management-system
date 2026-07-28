ALTER TABLE "Customer" ADD COLUMN "email" TEXT;

CREATE TABLE "LegalTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerMessage" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalTemplate_key_key" ON "LegalTemplate"("key");
CREATE UNIQUE INDEX "CustomerDocument_publicToken_key" ON "CustomerDocument"("publicToken");
CREATE UNIQUE INDEX "CustomerMessage_dedupeKey_key" ON "CustomerMessage"("dedupeKey");
CREATE INDEX "CustomerDocument_customerId_createdAt_idx" ON "CustomerDocument"("customerId", "createdAt");
CREATE INDEX "CustomerDocument_accountId_createdAt_idx" ON "CustomerDocument"("accountId", "createdAt");
CREATE INDEX "CustomerMessage_status_scheduledAt_idx" ON "CustomerMessage"("status", "scheduledAt");
CREATE INDEX "CustomerMessage_customerId_createdAt_idx" ON "CustomerMessage"("customerId", "createdAt");

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CustomerDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Setting"
SET
  "emailNotificationsEnabled" = true,
  "smsNotificationsEnabled" = true,
  "whatsappRemindersEnabled" = true;
