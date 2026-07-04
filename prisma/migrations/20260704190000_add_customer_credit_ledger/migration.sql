CREATE TYPE "CreditStatus" AS ENUM ('OPEN', 'REFUNDED', 'APPLIED', 'VOID');

CREATE TYPE "CreditSource" AS ENUM ('PAYMENT_OVERPAYMENT', 'MANUAL_ADJUSTMENT');

CREATE TABLE "CustomerCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT,
    "paymentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'OPEN',
    "source" "CreditSource" NOT NULL DEFAULT 'PAYMENT_OVERPAYMENT',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCredit_paymentId_key" ON "CustomerCredit"("paymentId");

CREATE INDEX "CustomerCredit_customerId_status_idx" ON "CustomerCredit"("customerId", "status");

CREATE INDEX "CustomerCredit_accountId_idx" ON "CustomerCredit"("accountId");

CREATE INDEX "CustomerCredit_paymentId_idx" ON "CustomerCredit"("paymentId");

ALTER TABLE "CustomerCredit"
ADD CONSTRAINT "CustomerCredit_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCredit"
ADD CONSTRAINT "CustomerCredit_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCredit"
ADD CONSTRAINT "CustomerCredit_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
