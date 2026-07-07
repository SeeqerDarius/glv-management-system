-- AlterTable
ALTER TABLE "StaffSalaryPayment" ADD COLUMN "salaryMonth" TIMESTAMP(3);

-- Existing records did not store the month being paid. Salaries paid in the
-- first 10 days are treated as settlement for the previous salary month.
UPDATE "StaffSalaryPayment"
SET "salaryMonth" = CASE
  WHEN EXTRACT(DAY FROM "paymentDate") <= 10
    THEN date_trunc('month', "paymentDate" - INTERVAL '1 month')::timestamp
  ELSE date_trunc('month', "paymentDate")::timestamp
END;

ALTER TABLE "StaffSalaryPayment" ALTER COLUMN "salaryMonth" SET NOT NULL;

-- CreateIndex
CREATE INDEX "StaffSalaryPayment_staffId_salaryMonth_idx" ON "StaffSalaryPayment"("staffId", "salaryMonth");
