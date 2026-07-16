-- Add account-level two-factor authentication controls.
ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecret" TEXT,
ADD COLUMN "twoFactorConfirmedAt" TIMESTAMP(3);

-- Track failed login attempts per normalized identifier.
CREATE TABLE "LoginRateLimit" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginRateLimit_identifier_key" ON "LoginRateLimit"("identifier");
CREATE INDEX "LoginRateLimit_lockedUntil_idx" ON "LoginRateLimit"("lockedUntil");
CREATE INDEX "LoginRateLimit_lastAttemptAt_idx" ON "LoginRateLimit"("lastAttemptAt");
