ALTER TABLE "Staff"
ADD COLUMN "expectedSalary" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Product"
ADD COLUMN "description" TEXT,
ADD COLUMN "transportCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "quantityOnSale" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StaffSalaryPayment" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "paidBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffSalaryPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffSalaryPayment"
ADD CONSTRAINT "StaffSalaryPayment_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "StaffSalaryPayment_staffId_paymentDate_idx"
ON "StaffSalaryPayment"("staffId", "paymentDate");
